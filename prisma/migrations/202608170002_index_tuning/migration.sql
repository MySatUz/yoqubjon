-- Index tuning. Already applied to the database out of band with
-- CREATE/DROP INDEX CONCURRENTLY (see prisma/manual-migrations/20260817_index_tuning.sql),
-- then registered here with `prisma migrate resolve --applied`.
--
-- These are the plain, transaction-safe equivalents so a fresh database built
-- from migration history ends up with the same indexes. Do not add CONCURRENTLY
-- here: Prisma wraps every migration.sql in a transaction, which it forbids.
--
-- Verified against production data before applying — the two additional drops
-- suggested by the audit were rejected because pg_stat_user_indexes showed the
-- indexes in active use (Result_userId_idx: 2969 scans,
-- Subscription_userId_idx: 212 scans).

-- Serves result.count({ where: { userId, testId } }) on every exam submission,
-- and groupBy(['testId']) on the dashboard. Replaces a BitmapAnd of two indexes.
CREATE INDEX IF NOT EXISTS "Result_userId_testId_idx" ON "Result" ("userId", "testId");

-- /admin/payments sorts status ASC, createdAt DESC. A plain ascending b-tree
-- cannot serve mixed-direction ordering, so the column order is made explicit.
DROP INDEX IF EXISTS "ManualPaymentRequest_status_createdAt_idx";
CREATE INDEX IF NOT EXISTS "ManualPaymentRequest_status_createdAt_idx"
  ON "ManualPaymentRequest" ("status", "createdAt" DESC);

-- Pure duplicate: `transactionId String? @unique` already creates
-- Payment_transactionId_key. Two identical b-trees, both paid for on write.
DROP INDEX IF EXISTS "Payment_transactionId_idx";
