-- Widens the solved count so it can hold partial credit.
--
-- A multi-select question is graded as
--   (chosen right - chosen wrong) / (right options)
-- clamped to 0..1, so an attempt's total is no longer whole. INTEGER ->
-- DOUBLE PRECISION is a widening cast: every existing count keeps its exact
-- value, and NULL stays NULL.
--
-- No existing count has to be re-graded: every row written before this point
-- was graded all-or-nothing and is already correct under the new rule - none of
-- them could hold a multi-select question, because no `.tex` file could express
-- one until now. The backfill at the end is a separate repair, for rows that
-- have no count at all.

-- AlterTable
ALTER TABLE "Result" ALTER COLUMN "correctCount" TYPE DOUBLE PRECISION;

-- Repairs the rows the missing write left behind. Every attempt submitted
-- between the migration that added `correctCount` and the fix that finally
-- stored it has NULL here, so `rankOlympiadAttempts` skipped it. They were all
-- graded all-or-nothing, so the count is exactly what the previous backfill
-- computed: one point per answer already flagged correct on the row.
UPDATE "Result"
SET "correctCount" = (
  SELECT COUNT(*)
  FROM jsonb_each("answers"::jsonb) AS answer
  WHERE (answer.value ->> 'isCorrect')::boolean
)
WHERE "correctCount" IS NULL
  AND EXISTS (
    SELECT 1
    FROM jsonb_each("answers"::jsonb) AS answer
    WHERE answer.value ? 'isCorrect'
  );
