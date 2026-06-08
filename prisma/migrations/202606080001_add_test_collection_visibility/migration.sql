CREATE TABLE "TestCollectionVisibility" (
  "category" TEXT NOT NULL,
  "visible" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TestCollectionVisibility_pkey" PRIMARY KEY ("category")
);

INSERT INTO "TestCollectionVisibility" ("category", "visible", "createdAt", "updatedAt")
VALUES
  ('STANDARD', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ADVANCED', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('PLANCK', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("category") DO NOTHING;
