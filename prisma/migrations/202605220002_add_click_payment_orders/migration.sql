CREATE TABLE "PaymentOrder" (
  "id" TEXT NOT NULL,
  "prepareId" BIGSERIAL NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'CLICK',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'UZS',
  "months" INTEGER NOT NULL DEFAULT 1,
  "providerTransactionId" TEXT,
  "providerPaymentId" TEXT,
  "providerPrepareId" TEXT,
  "providerConfirmId" TEXT,
  "providerError" INTEGER,
  "providerErrorNote" TEXT,
  "providerPayload" JSONB NOT NULL DEFAULT '{}',
  "paidAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PaymentOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentOrder_prepareId_key" ON "PaymentOrder"("prepareId");
CREATE UNIQUE INDEX "PaymentOrder_provider_providerTransactionId_key" ON "PaymentOrder"("provider", "providerTransactionId");
CREATE INDEX "PaymentOrder_userId_status_createdAt_idx" ON "PaymentOrder"("userId", "status", "createdAt");
CREATE INDEX "PaymentOrder_prepareId_idx" ON "PaymentOrder"("prepareId");

ALTER TABLE "PaymentOrder"
ADD CONSTRAINT "PaymentOrder_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
