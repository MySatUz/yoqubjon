CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

ALTER TABLE "User"
ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';

UPDATE "User"
SET "role" = 'ADMIN'
WHERE "email" IN ('admin@mysat.uz', 'abdunazarovmardon@gmail.com');
