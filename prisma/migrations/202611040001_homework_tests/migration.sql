-- Homework tests: one list of questions with no time limit and no finish.
-- Each answer is checked on the server when it is chosen and kept here, so a
-- student sees right or wrong at once and comes back to where they were.
-- Start over deletes the student's rows for the test.
--
-- Purely additive: every existing test gets homework = false and stays as it
-- is, and the new table starts empty. A deployment from before this migration
-- never reads either. Apply before the code that reads them is deployed.

-- AlterTable
ALTER TABLE "Test" ADD COLUMN     "homework" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "HomeworkAnswer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "credit" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeworkAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomeworkAnswer_testId_idx" ON "HomeworkAnswer"("testId");

-- CreateIndex
CREATE INDEX "HomeworkAnswer_questionId_idx" ON "HomeworkAnswer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "HomeworkAnswer_userId_testId_questionId_key" ON "HomeworkAnswer"("userId", "testId", "questionId");

-- AddForeignKey
ALTER TABLE "HomeworkAnswer" ADD CONSTRAINT "HomeworkAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkAnswer" ADD CONSTRAINT "HomeworkAnswer_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkAnswer" ADD CONSTRAINT "HomeworkAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

