ALTER TABLE "Subscription"
ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "providerSubscriptionId" TEXT,
ADD COLUMN "providerCustomerId" TEXT,
ADD COLUMN "providerVariantId" TEXT,
ADD COLUMN "providerStatus" TEXT;

CREATE UNIQUE INDEX "Subscription_providerSubscriptionId_key" ON "Subscription"("providerSubscriptionId");
