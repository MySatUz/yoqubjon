-- SAT-style modules: a test can be split into timed modules that each run on
-- their own clock. Existing tests stay single-module (empty array) and keep
-- using "durationSeconds".
ALTER TABLE "Test"
ADD COLUMN "moduleDurations" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

ALTER TABLE "Question"
ADD COLUMN "moduleIndex" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Question"
ADD CONSTRAINT "Question_moduleIndex_check"
CHECK ("moduleIndex" BETWEEN 1 AND 6);

CREATE INDEX "Question_testId_moduleIndex_order_idx"
ON "Question"("testId", "moduleIndex", "order");
