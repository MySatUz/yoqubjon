ALTER TABLE "Test"
  ADD COLUMN "visible" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "Test_visible_idx" ON "Test"("visible");
