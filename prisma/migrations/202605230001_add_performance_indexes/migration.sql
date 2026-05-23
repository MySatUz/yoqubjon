CREATE INDEX IF NOT EXISTS "Test_createdAt_idx"
ON "Test"("createdAt");

CREATE INDEX IF NOT EXISTS "Question_testId_order_idx"
ON "Question"("testId", "order");

CREATE INDEX IF NOT EXISTS "Result_userId_createdAt_idx"
ON "Result"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "Result_testId_idx"
ON "Result"("testId");

CREATE INDEX IF NOT EXISTS "Subscription_userId_isActive_expiresAt_idx"
ON "Subscription"("userId", "isActive", "expiresAt");
