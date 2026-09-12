import { prisma } from "@/lib/prisma";
import { tokenizeMathText, unescapePlainText } from "@/lib/mathTokens";

/** One question's record across every attempt at the test it belongs to. */
export type QuestionStat = {
  /** Attempts whose stored answers carry this question at all. */
  responses: number;
  /** Attempts that got it fully right. */
  correct: number;
  /** Attempts that left it blank. */
  blank: number;
  /**
   * Summed 0..1 credit. Equal to `correct` unless the question is
   * multi-select, where an attempt can earn part of it.
   */
  credit: number;
};

export type TestParticipation = {
  attempts: number;
  /** Distinct people, which is not `attempts`: one student may retake a test. */
  students: number;
};

type QuestionStatRow = QuestionStat & { questionId: string };

/**
 * How many attempts the test has and how many people they came from.
 *
 * `COUNT(DISTINCT ...)` is why this is raw SQL: `prisma.result.groupBy` cannot
 * express it, and counting distinct users in Node would mean reading every
 * attempt row back just to throw all but the id away.
 */
export async function fetchTestParticipation(testId: string): Promise<TestParticipation> {
  const rows = await prisma.$queryRaw<Array<{ attempts: number; students: number }>>`
    SELECT COUNT(*)::int                 AS "attempts",
           COUNT(DISTINCT "userId")::int AS "students"
      FROM "Result"
     WHERE "testId" = ${testId}
  `;

  return rows[0] ?? { attempts: 0, students: 0 };
}

/**
 * Per-question tallies for one test, keyed by question id.
 *
 * Every attempt stores one entry per question — `createExamResult` writes an
 * entry even for a question the student never touched — so this folds the whole
 * attempt history down in Postgres rather than pulling a few kilobytes of
 * answer JSON per attempt into Node.
 *
 * The `CASE` around `jsonb_each` is load-bearing: the function raises on a
 * non-object, and a `WHERE jsonb_typeof(...)` qual is not guaranteed to be
 * evaluated before a lateral function call. Feeding it `'{}'` instead drops the
 * row without an error. The same care applies one level down — an attempt
 * written before answers became objects stores a bare string per question, and
 * such entries are skipped rather than counted as wrong.
 */
export async function fetchQuestionStats(testId: string): Promise<Map<string, QuestionStat>> {
  const rows = await prisma.$queryRaw<QuestionStatRow[]>`
    SELECT answer.key                                              AS "questionId",
           COUNT(*)::int                                           AS "responses",
           COUNT(*) FILTER (
             WHERE (answer.value ->> 'isCorrect')::boolean
           )::int                                                  AS "correct",
           COUNT(*) FILTER (
             WHERE COALESCE(answer.value ->> 'userAnswer', '') = ''
           )::int                                                  AS "blank",
           COALESCE(SUM(
             COALESCE(
               NULLIF(answer.value ->> 'credit', '')::double precision,
               CASE WHEN (answer.value ->> 'isCorrect')::boolean THEN 1 ELSE 0 END
             )
           ), 0)::double precision                                 AS "credit"
      FROM "Result" r
      CROSS JOIN LATERAL jsonb_each(
        CASE
          WHEN jsonb_typeof(r."answers"::jsonb) = 'object' THEN r."answers"::jsonb
          ELSE '{}'::jsonb
        END
      ) AS answer
     WHERE r."testId" = ${testId}
       AND jsonb_typeof(answer.value) = 'object'
     GROUP BY answer.key
  `;

  return new Map(rows.map(({ questionId, ...stat }) => [questionId, stat]));
}

const EMPTY_STAT: QuestionStat = { responses: 0, correct: 0, blank: 0, credit: 0 };

export function readQuestionStat(stats: Map<string, QuestionStat>, questionId: string) {
  return stats.get(questionId) ?? EMPTY_STAT;
}

/**
 * A one-line, KaTeX-free version of a question, so a table row can be matched
 * to the question it counts without paying for a maths renderer 44 times.
 *
 * Inline maths keeps its source — it is usually a single variable, and "The
 * function w models…" reads better than a gap. Display maths is a whole
 * equation on its own line and would swamp the excerpt, so it becomes an
 * ellipsis.
 */
export function questionExcerpt(content: string, maxLength = 120) {
  const text = tokenizeMathText(content)
    .map((token) => {
      if (token.type === 'text') return unescapePlainText(token.value);
      // `5{,}340` is how TeX writes a thousands separator; in a plain excerpt
      // the braces are just noise.
      return token.type === 'inlineMath' ? token.value.replace(/\{,\}/g, ',') : ' … ';
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length <= maxLength) return text;

  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}
