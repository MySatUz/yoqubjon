CREATE TABLE "SectionAccess" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "userId" TEXT,
  "category" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "note" TEXT,
  "grantedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SectionAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SectionAccess_email_category_key" ON "SectionAccess"("email", "category");
CREATE INDEX "SectionAccess_userId_idx" ON "SectionAccess"("userId");
CREATE INDEX "SectionAccess_category_idx" ON "SectionAccess"("category");
CREATE INDEX "SectionAccess_expiresAt_idx" ON "SectionAccess"("expiresAt");

ALTER TABLE "SectionAccess"
ADD CONSTRAINT "SectionAccess_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SectionAccess"
ADD CONSTRAINT "SectionAccess_category_fkey"
FOREIGN KEY ("category") REFERENCES "TestCollectionVisibility"("category") ON DELETE CASCADE ON UPDATE CASCADE;
