-- A test with no time limit: the student is never timed out, and the time
-- taken is only recorded. The duration columns keep positive placeholders, so
-- the module count they carry is unchanged.
--
-- Purely additive: every existing test gets untimed = false and stays timed. A
-- deployment from before this migration never reads the column. Apply before
-- the code that reads it is deployed.

-- AlterTable
ALTER TABLE "Test" ADD COLUMN "untimed" BOOLEAN NOT NULL DEFAULT false;
