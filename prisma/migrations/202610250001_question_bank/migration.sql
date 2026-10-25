-- The question bank: a table of its own, and a nullable link from Question.
--
-- Purely additive. No existing row changes: every Question gets a NULL
-- bankQuestionId, which the app reads as "not from the bank", and Prisma lists
-- columns explicitly, so a deployment from before this migration keeps working
-- against a database that already has it. Apply before the code that reads
-- the bank is deployed.

-- CreateTable
CREATE TABLE "BankQuestion" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "imageUrl" TEXT,
    "domain" TEXT,
    "difficulty" INTEGER,
    "source" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankQuestion_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Question" ADD COLUMN "bankQuestionId" TEXT;

-- CreateIndex
CREATE INDEX "BankQuestion_domain_difficulty_idx" ON "BankQuestion"("domain", "difficulty");

-- CreateIndex
CREATE INDEX "BankQuestion_createdAt_idx" ON "BankQuestion"("createdAt");

-- CreateIndex
CREATE INDEX "Question_bankQuestionId_idx" ON "Question"("bankQuestionId");

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_bankQuestionId_fkey" FOREIGN KEY ("bankQuestionId") REFERENCES "BankQuestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
