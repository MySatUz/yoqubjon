ALTER TABLE "Test"
  ADD COLUMN "durationSeconds" INTEGER NOT NULL DEFAULT 7200,
  ADD COLUMN "collectionCategory" TEXT;

ALTER TABLE "TestCollectionVisibility"
  ADD COLUMN "label" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

UPDATE "TestCollectionVisibility"
SET
  "label" = CASE "category"
    WHEN 'STANDARD' THEN 'Standard tests'
    WHEN 'ADVANCED' THEN 'Advanced set'
    WHEN 'PLANCK' THEN 'Planck set'
    ELSE "label"
  END,
  "description" = CASE "category"
    WHEN 'STANDARD' THEN 'Core SAT Math modules for regular practice.'
    WHEN 'ADVANCED' THEN 'Harder SAT Math sets for premium-level training.'
    WHEN 'PLANCK' THEN 'Precision-focused SAT Math sets for the toughest practice.'
    ELSE "description"
  END,
  "position" = CASE "category"
    WHEN 'STANDARD' THEN 10
    WHEN 'ADVANCED' THEN 20
    WHEN 'PLANCK' THEN 30
    ELSE "position"
  END;

UPDATE "Test"
SET "collectionCategory" = CASE
  WHEN "description" ~* '^\[ADVANCED\]' OR "title" ~* '^advanced\s+set\s*\d*' THEN 'ADVANCED'
  WHEN "description" ~* '^\[PLANCK\]' OR "title" ~* '^planck\s+set\s*\d*' THEN 'PLANCK'
  ELSE 'STANDARD'
END
WHERE "collectionCategory" IS NULL;

CREATE INDEX "Test_collectionCategory_idx" ON "Test"("collectionCategory");

ALTER TABLE "Test"
  ADD CONSTRAINT "Test_collectionCategory_fkey"
  FOREIGN KEY ("collectionCategory")
  REFERENCES "TestCollectionVisibility"("category")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
