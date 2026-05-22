CREATE TABLE "ManualPaymentRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'UZS',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "payerName" TEXT,
  "contact" TEXT,
  "paymentReference" TEXT,
  "receiptPath" TEXT,
  "receiptFileName" TEXT,
  "receiptMimeType" TEXT,
  "message" TEXT,
  "adminNote" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ManualPaymentRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ManualPaymentRequest_userId_idx" ON "ManualPaymentRequest"("userId");
CREATE INDEX "ManualPaymentRequest_status_createdAt_idx" ON "ManualPaymentRequest"("status", "createdAt");

ALTER TABLE "ManualPaymentRequest"
ADD CONSTRAINT "ManualPaymentRequest_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
