-- Adds the olympiad window to Test, and the solved count to Result.
--
-- `correctCount` is stored rather than derived from `score`: the score is a
-- SAT-scale estimate rounded through a 44-question reference
-- (`Math.round(correct / total * 44)`), so on a test of any other length two
-- different counts collapse onto the same score. A ranking built on it would tie
-- people who did not tie, and could not show "solved 18 of 22" at all.
--
-- The backfill is safe for every row that exists today: all 1193 of them store
-- an `isCorrect` flag on every answer, checked against production before this
-- migration was written. Rows that somehow lack it end up NULL rather than 0, so
-- a missing count is never mistaken for a score of zero.

-- AlterTable
ALTER TABLE "Test"
  ADD COLUMN "olympiadStartsAt" TIMESTAMP(3),
  ADD COLUMN "olympiadEndsAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Result" ADD COLUMN "correctCount" INTEGER;

-- Backfill the solved count from the answers already on the row.
UPDATE "Result"
SET "correctCount" = (
  SELECT COUNT(*)
  FROM jsonb_each("answers"::jsonb) AS answer
  WHERE (answer.value ->> 'isCorrect')::boolean
)
WHERE EXISTS (
  SELECT 1
  FROM jsonb_each("answers"::jsonb) AS answer
  WHERE answer.value ? 'isCorrect'
);
