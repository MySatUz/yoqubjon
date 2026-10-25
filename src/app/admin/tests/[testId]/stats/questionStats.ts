import { prisma } from '@/lib/prisma';

/** How one question fared across every attempt at a test. */
export type QuestionAnswerStats = {
  /** Attempts whose stored answers have an entry for the question. */
  seen: number;
  /** Of those, the ones with any answer at all; the rest were left blank. */
  answered: number;
  /** Credit earned in total: a multi-select answered half right adds 0.5. */
  credit: number;
  /** The wrong answer given most often, and by how many attempts. */
  topWrong: { answer: string; count: number } | null;
};

type QuestionStatsRow = {
  key: string;
  seen: number;
  answered: number;
  credit: number;
  wrongAnswer: string | null;
  wrongCount: number | null;
};

/**
 * Per-question totals read straight from `Result.answers`, keyed the way the
 * answers are stored: by question id, or - on attempts written before that -
 * by the question's zero-based position. The caller looks a question up under
 * both keys, as the review page does.
 *
 * Grading follows `fetchTestRoster` in testStats.ts: the stored `credit`, else
 * the stored `isCorrect`, never a regrade, so the questions table and the
 * roster above it can never disagree about what counted. Aggregated in SQL so
 * the page does not pull every attempt's answers into Node to count them.
 */
export async function fetchQuestionAnswerStats(testId: string) {
  const rows = await prisma.$queryRaw<QuestionStatsRow[]>`
    WITH answer AS (
      SELECT entry.key AS "key",
             btrim(COALESCE(entry.value ->> 'userAnswer', '')) AS "userAnswer",
             COALESCE(
               NULLIF(entry.value ->> 'credit', '')::double precision,
               CASE WHEN (entry.value ->> 'isCorrect')::boolean THEN 1 ELSE 0 END
             ) AS "credit"
        FROM "Result" r
        CROSS JOIN LATERAL jsonb_each(
          CASE
            WHEN jsonb_typeof(r."answers"::jsonb) = 'object' THEN r."answers"::jsonb
            ELSE '{}'::jsonb
          END
        ) AS entry
       WHERE r."testId" = ${testId}
         AND jsonb_typeof(entry.value) = 'object'
    ),
    totals AS (
      SELECT "key",
             COUNT(*)::int                                   AS "seen",
             COUNT(*) FILTER (WHERE "userAnswer" <> '')::int AS "answered",
             COALESCE(SUM("credit"), 0)::double precision    AS "credit"
        FROM answer
       GROUP BY "key"
    ),
    wrong AS (
      SELECT DISTINCT ON ("key")
             "key",
             "userAnswer"    AS "wrongAnswer",
             COUNT(*)::int   AS "wrongCount"
        FROM answer
       WHERE "userAnswer" <> '' AND "credit" < 1
       GROUP BY "key", "userAnswer"
       ORDER BY "key", COUNT(*) DESC, "userAnswer" ASC
    )
    SELECT t."key", t."seen", t."answered", t."credit", w."wrongAnswer", w."wrongCount"
      FROM totals t
      LEFT JOIN wrong w ON w."key" = t."key"
  `;

  return new Map<string, QuestionAnswerStats>(rows.map((row) => [row.key, {
    seen: row.seen,
    answered: row.answered,
    credit: row.credit,
    topWrong: row.wrongAnswer !== null && row.wrongCount !== null
      ? { answer: row.wrongAnswer, count: row.wrongCount }
      : null,
  }]));
}

/**
 * One question's totals from both of its possible keys. An attempt is keyed
 * one way or the other, never both, so the two buckets simply add up.
 */
export function mergeQuestionStats(
  byId: QuestionAnswerStats | undefined,
  byPosition: QuestionAnswerStats | undefined,
): QuestionAnswerStats {
  const parts = [byId, byPosition].filter((part): part is QuestionAnswerStats => part !== undefined);
  const topWrong = parts
    .map((part) => part.topWrong)
    .filter((wrong): wrong is NonNullable<QuestionAnswerStats['topWrong']> => wrong !== null)
    .sort((a, b) => b.count - a.count)[0] ?? null;

  return {
    seen: parts.reduce((total, part) => total + part.seen, 0),
    answered: parts.reduce((total, part) => total + part.answered, 0),
    credit: parts.reduce((total, part) => total + part.credit, 0),
    topWrong,
  };
}
