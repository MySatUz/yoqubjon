CREATE TABLE "SubscriptionSetting" (
    "id" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionSetting_pkey" PRIMARY KEY ("id")
);

INSERT INTO "SubscriptionSetting" ("id", "isEnabled", "updatedAt")
VALUES ('global', true, CURRENT_TIMESTAMP);
