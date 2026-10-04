-- Adds an optional six-digit access code to a test, and the table that
-- remembers which students have entered it.
--
-- Purely additive: `accessCode` is NULL on every existing test, and a NULL code
-- means the test opens exactly as it did before.

-- AlterTable
ALTER TABLE "Test" ADD COLUMN "accessCode" TEXT;

-- CreateTable
CREATE TABLE "TestCodeUnlock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "code" TEXT,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastFailedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestCodeUnlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TestCodeUnlock_userId_testId_key" ON "TestCodeUnlock"("userId", "testId");

-- CreateIndex
CREATE INDEX "TestCodeUnlock_testId_idx" ON "TestCodeUnlock"("testId");

-- AddForeignKey
ALTER TABLE "TestCodeUnlock" ADD CONSTRAINT "TestCodeUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCodeUnlock" ADD CONSTRAINT "TestCodeUnlock_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;
