-- A payment request names the one course it buys.
--
-- Purely additive: existing requests keep a NULL category, which the app reads
-- as a request for Premium (every course), the only thing that could be bought
-- when they were sent. Prisma lists columns explicitly, so a deployment from
-- before this migration keeps working against a database that already has it.
-- Apply before the code that writes the column is deployed.

-- AlterTable
ALTER TABLE "ManualPaymentRequest" ADD COLUMN "category" TEXT;
