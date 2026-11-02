-- The official question bank: a flag on BankQuestion, so the questions an
-- admin takes from the College Board's open SAT question bank live apart from
-- our own.
--
-- Additive for the rows: every existing question gets official = false and
-- stays in our own bank. The domain-and-difficulty index gains the flag in
-- front, since every bank read now filters by it. A deployment from before
-- this migration ignores the new column. Apply before the code that reads it
-- is deployed.

-- AlterTable
ALTER TABLE "BankQuestion" ADD COLUMN "official" BOOLEAN NOT NULL DEFAULT false;

-- DropIndex
DROP INDEX "BankQuestion_domain_difficulty_idx";

-- CreateIndex
CREATE INDEX "BankQuestion_official_domain_difficulty_idx" ON "BankQuestion"("official", "domain", "difficulty");
