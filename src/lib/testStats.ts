import { prisma } from "@/lib/prisma";

export type TestParticipation = {
  attempts: number;
  /** Distinct people, which is not `attempts`: one student may retake a test. */
  students: number;
};

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

/** One student's record on one test, folded down from all of their attempts. */
export type TestStudentRow = {
  userId: string;
  name: string | null;
  email: string;
  attempts: number;
  /** Questions solved in their best attempt; fractional with multi-select. */
  bestCorrect: number;
  /** Score and time of that same attempt, not of some other one. */
  bestScore: number;
  bestTimeSpent: number;
  totalTimeSpent: number;
  latestAt: Date | null;
  /**
   * Solved count of every attempt in the order they were taken, so a retake
   * shows whether the student actually improved. Capped - a roster row is not
   * the place for a hundred numbers.
   */
  correctCounts: number[];
};

export const TEST_ROSTER_PAGE_SIZE = 100;

/**
 * Attempts listed per student before the row stops enumerating them. Applied
 * in JS, not as an SQL array slice: the bound would have to be a parameter, and
 * the array is short anyway - a student cannot exceed the test's maxAttempts.
 */
const MAX_LISTED_ATTEMPTS = 12;

type TestStudentRawRow = Omit<TestStudentRow, 'bestCorrect' | 'correctCounts'> & {
  bestCorrect: number | null;
  correctCounts: number[] | null;
};

/**
 * Who took the test and how many questions each of them got right.
 *
 * One row per student, ranked by their best attempt. `DISTINCT ON` picks that
 * attempt whole, so the score and the time next to a solved count belong to the
 * same sitting - `MAX(score)` and `MAX(correct)` over the group would happily
 * report two different attempts side by side.
 *
 * `Result.correctCount` is the stored total, but it is NULL on attempts written
 * before the column was filled in, and a roster that silently ranked those
 * students last would be worse than useless. The COALESCE recomputes the count
 * from the answers already on the row, the same way the backfill migration did.
 */
export async function fetchTestRoster(
  testId: string,
  options: { take?: number; skip?: number } = {}
): Promise<TestStudentRow[]> {
  const take = Math.max(1, Math.trunc(options.take ?? TEST_ROSTER_PAGE_SIZE));
  const skip = Math.max(0, Math.trunc(options.skip ?? 0));

  const rows = await prisma.$queryRaw<TestStudentRawRow[]>`
    WITH attempt AS (
      SELECT r."userId"    AS "userId",
             r."score"     AS "score",
             r."timeSpent" AS "timeSpent",
             r."createdAt" AS "createdAt",
             COALESCE(
               r."correctCount",
               (
                 SELECT COALESCE(SUM(
                   COALESCE(
                     NULLIF(answer.value ->> 'credit', '')::double precision,
                     CASE WHEN (answer.value ->> 'isCorrect')::boolean THEN 1 ELSE 0 END
                   )
                 ), 0)
                   FROM jsonb_each(
                     CASE
                       WHEN jsonb_typeof(r."answers"::jsonb) = 'object' THEN r."answers"::jsonb
                       ELSE '{}'::jsonb
                     END
                   ) AS answer
                  WHERE jsonb_typeof(answer.value) = 'object'
               )
             )           AS "correct"
        FROM "Result" r
       WHERE r."testId" = ${testId}
    ),
    best AS (
      SELECT DISTINCT ON ("userId")
             "userId", "correct", "score", "timeSpent"
        FROM attempt
       ORDER BY "userId", "correct" DESC, "score" DESC, "createdAt" DESC
    ),
    totals AS (
      SELECT "userId",
             COUNT(*)::int        AS "attempts",
             SUM("timeSpent")::int AS "totalTimeSpent",
             MAX("createdAt")     AS "latestAt",
             array_agg("correct" ORDER BY "createdAt") AS "correctCounts"
        FROM attempt
       GROUP BY "userId"
    )
    SELECT b."userId"                  AS "userId",
           u."name"                    AS "name",
           u."email"                   AS "email",
           t."attempts"                AS "attempts",
           b."correct"::double precision AS "bestCorrect",
           b."score"                   AS "bestScore",
           b."timeSpent"               AS "bestTimeSpent",
           t."totalTimeSpent"          AS "totalTimeSpent",
           t."latestAt"                AS "latestAt",
           t."correctCounts"           AS "correctCounts"
      FROM best b
      JOIN totals t ON t."userId" = b."userId"
      JOIN "User" u ON u."id" = b."userId"
     ORDER BY "bestCorrect" DESC,
              "bestScore" DESC,
              "latestAt" DESC,
              "email" ASC
     LIMIT ${take} OFFSET ${skip}
  `;

  return rows.map((row) => ({
    ...row,
    bestCorrect: row.bestCorrect ?? 0,
    correctCounts: (row.correctCounts ?? []).slice(0, MAX_LISTED_ATTEMPTS),
  }));
}
