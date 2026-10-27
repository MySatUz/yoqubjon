-- Names the exam attempt a result finishes, so one attempt can never be filed
-- twice: a reload while the result is being sent, two tabs on one attempt, or
-- a retry after the response was lost on a bad connection used to each add a
-- row - and use up an attempt.
--
-- Purely additive: `attemptId` is NULL on every existing row and on every row
-- an older client sends, and NULL rows are outside the index below, so those
-- submissions behave exactly as before.

-- AlterTable
ALTER TABLE "Result" ADD COLUMN "attemptId" TEXT;

-- CreateIndex
-- Partial, which Prisma cannot express: schema.prisma names it in a comment on
-- the Result model instead, so `prisma migrate diff` will offer to drop it.
CREATE UNIQUE INDEX "Result_userId_attemptId_key" ON "Result"("userId", "attemptId")
WHERE "attemptId" IS NOT NULL;
