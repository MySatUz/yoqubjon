-- ============================================================================
-- Index tuning — MANUAL migration. NOT applied automatically.
--
-- WHY THIS FILE IS NOT IN prisma/migrations/
--   1. Prisma only scans `prisma/migrations/*/migration.sql`. Anything under
--      `prisma/manual-migrations/` is invisible to `prisma migrate deploy`,
--      so this cannot be picked up by a deploy pipeline by accident.
--   2. `CREATE INDEX CONCURRENTLY` / `DROP INDEX CONCURRENTLY` cannot run
--      inside a transaction block, and Prisma's migration runner wraps every
--      migration.sql in one. Putting these statements in prisma/migrations/
--      would fail with "CREATE INDEX CONCURRENTLY cannot run inside a
--      transaction block", or — worse — silently be rewritten to the blocking
--      non-concurrent form by a well-meaning edit.
--   3. The database is live. CONCURRENTLY is what keeps these DDL statements
--      from taking an ACCESS EXCLUSIVE lock and blocking exam submissions.
--
-- HOW TO APPLY (manually, one statement at a time, against production):
--
--   psql "$DATABASE_URL" -f prisma/manual-migrations/20260817_index_tuning.sql
--
--   psql runs each statement in its own implicit transaction, which is what
--   CONCURRENTLY needs. Do NOT wrap this file in BEGIN/COMMIT and do NOT run
--   it through `prisma db execute` (that opens a transaction).
--
-- AFTER APPLYING — keep migration history consistent with schema.prisma:
--   The Prisma models were already updated, so `prisma migrate status` will
--   report drift. Resolve it without re-running DDL:
--     1. Create prisma/migrations/<timestamp>_index_tuning/migration.sql
--        holding the plain (non-CONCURRENTLY) equivalents below.
--     2. Mark it as already applied:
--          npx prisma migrate resolve --applied <timestamp>_index_tuning
--   Never let `prisma migrate dev` generate and run this against production.
--
-- IF A STATEMENT FAILS: CREATE INDEX CONCURRENTLY leaves behind an INVALID
-- index that still costs writes but is never used for reads. Check and clean:
--   SELECT c.relname FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
--   WHERE NOT i.indisvalid;
--   DROP INDEX CONCURRENTLY "<name>";
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. ADD  Result (userId, testId)                                    [DO IT]
--
-- Measured on production (1081 rows, 209 distinct users, max 10 attempts per
-- (user,test)):
--   result.count({ where: { userId, testId } })  — exam/[id]/page.tsx,
--   examSubmission.ts:190 — currently plans as
--     Aggregate -> Bitmap Heap Scan -> BitmapAnd
--        -> Bitmap Index Scan on Result_testId_idx
--        -> Bitmap Index Scan on Result_userId_createdAt_idx
--     buffers: shared hit=11, exec 0.35 ms
--   With (userId, testId) this collapses to one index scan (~2-4 buffers).
--
--   dashboard groupBy(['testId']) currently reads 32 heap blocks
--   (Bitmap Heap Scan, buffers hit=34) because testId is not in the index;
--   with this index the aggregate can be served index-only.
--
-- Absolute gain today is sub-millisecond. Justification is the plan shape on
-- the hottest write path (every exam submission calls the count), not the
-- current wall-clock number.
-- ----------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Result_userId_testId_idx"
  ON "Result" ("userId", "testId");


-- ----------------------------------------------------------------------------
-- 2. SWAP ManualPaymentRequest (status, createdAt) -> (status, createdAt DESC)
--                                                                    [DO IT]
--
-- /admin/payments orders by status ASC, createdAt DESC (payments/page.tsx:16-19).
-- Measured: with 8 rows the planner seq-scans and sorts. Forcing the index
-- (enable_seqscan=off) shows what happens once the table grows:
--     Incremental Sort (Sort Key: status, createdAt DESC; Presorted Key: status)
--       -> Index Scan using ManualPaymentRequest_status_createdAt_idx
-- i.e. the current index is usable only as a presorted *prefix*; the DESC half
-- still costs a sort per status group. Matching the direction removes the sort
-- node entirely.
--
-- Effect at 8 rows is unmeasurable. Applied anyway because it is a zero-cost
-- swap: same column count, same index size, same per-INSERT maintenance.
--
-- Built under a temporary name first so the table is never left without the
-- index (CREATE first, DROP second, then rename).
-- ----------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ManualPaymentRequest_status_createdAt_desc_idx"
  ON "ManualPaymentRequest" ("status", "createdAt" DESC);

DROP INDEX CONCURRENTLY IF EXISTS "ManualPaymentRequest_status_createdAt_idx";

-- Brief ACCESS EXCLUSIVE lock on the index only; effectively instant.
ALTER INDEX "ManualPaymentRequest_status_createdAt_desc_idx"
  RENAME TO "ManualPaymentRequest_status_createdAt_idx";


-- ----------------------------------------------------------------------------
-- 3. DROP Payment (transactionId)                                    [DO IT]
--
-- `transactionId String? @unique` already creates Payment_transactionId_key.
-- Payment_transactionId_idx indexes the exact same single column with the same
-- opclass and is a true duplicate — there is no query it can serve that the
-- unique index cannot.
--
-- Measured: both indexes 16 kB, both idx_scan = 0 over the whole recorded
-- stats window. EXPLAIN on `WHERE "transactionId" = $1` picks whichever the
-- planner tie-breaks to (observed: the _idx one); after the drop the _key
-- index serves the identical plan.
-- ----------------------------------------------------------------------------
DROP INDEX CONCURRENTLY IF EXISTS "Payment_transactionId_idx";


-- ============================================================================
-- DELIBERATELY NOT APPLIED — proposed by the audit, rejected on measurement.
-- Left here as commented SQL so the decision is not silently re-litigated.
-- ============================================================================

-- ---- SectionAccess (createdAt) --------------------------------- [DON'T DO]
-- /admin/sections does ORDER BY createdAt DESC LIMIT 500. Table holds 80 rows
-- in 3 pages; the seq scan + quicksort costs 0.37 ms and stays the chosen plan
-- even with enable_seqscan = off (there is simply no cheaper path at this size).
-- The index would only add write maintenance to a table with 82 lifetime
-- inserts. Revisit when SectionAccess passes ~10k rows.
--
-- CREATE INDEX CONCURRENTLY "SectionAccess_createdAt_idx"
--   ON "SectionAccess" ("createdAt" DESC);

-- ---- DROP Result (userId) -------------------------------------- [DON'T DO]
-- The audit assumed this index is dead weight fully covered by
-- Result_userId_createdAt_idx. Production stats contradict that:
--   Result_userId_idx            idx_scan = 2969, 40 kB
--   Result_userId_createdAt_idx  idx_scan = 13495, 112 kB
-- The planner actively prefers the narrow index where it can go index-only:
--   EXISTS (SELECT 1 FROM "Result" WHERE "userId" = $1)
--     -> Index Only Scan using Result_userId_idx (buffers hit=3)
--   User LEFT JOIN Result
--     -> Merge Join, Index Scan using Result_userId_idx
-- Dropping it is *safe* (leftmost-prefix substitution works) but trades a
-- 40 kB index-only path for a 112 kB one to save one B-tree insert per
-- exam submission — ~1098 inserts lifetime vs 2969 reads. Not worth it.
--
-- DROP INDEX CONCURRENTLY "Result_userId_idx";

-- ---- DROP Subscription (userId) -------------------------------- [DON'T DO]
-- The audit's premise is inverted by the stats:
--   Subscription_userId_idx                     idx_scan = 212
--   Subscription_userId_isActive_expiresAt_idx  idx_scan = 0
-- The supposedly-covering composite is the one that has never been used. The
-- table holds 4 rows in a single page, so the planner seq-scans regardless
-- (measured 0.35 ms); with enable_seqscan = off it picks the narrow index.
-- No measurable effect either way — do not churn a live index for it.
--
-- DROP INDEX CONCURRENTLY "Subscription_userId_idx";
