-- Lets a test show the questions of another test instead of its own: a copy
-- placed in a second section, under a title of its own, without storing the
-- questions or their images twice.
--
-- Purely additive: `questionSourceId` is NULL on every existing test, and a NULL
-- source means the test shows its own questions exactly as it did before.

-- AlterTable
ALTER TABLE "Test" ADD COLUMN "questionSourceId" TEXT;

-- CreateIndex
CREATE INDEX "Test_questionSourceId_idx" ON "Test"("questionSourceId");

-- AddForeignKey
ALTER TABLE "Test" ADD CONSTRAINT "Test_questionSourceId_fkey" FOREIGN KEY ("questionSourceId") REFERENCES "Test"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
