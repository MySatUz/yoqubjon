ALTER TABLE "TestCollectionVisibility"
ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 10;

ALTER TABLE "TestCollectionVisibility"
ADD CONSTRAINT "TestCollectionVisibility_maxAttempts_check"
CHECK ("maxAttempts" BETWEEN 1 AND 10000);

-- Seed each section limit from the tests it already holds so the new
-- setting matches what students currently see.
UPDATE "TestCollectionVisibility" AS c
SET "maxAttempts" = t."maxAttempts"
FROM (
  SELECT "collectionCategory" AS category, MAX("maxAttempts") AS "maxAttempts"
  FROM "Test"
  WHERE "collectionCategory" IS NOT NULL
  GROUP BY "collectionCategory"
) AS t
WHERE c."category" = t."category";
