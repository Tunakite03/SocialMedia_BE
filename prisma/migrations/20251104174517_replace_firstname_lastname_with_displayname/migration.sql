-- AlterTable
ALTER TABLE "users" ADD COLUMN "displayName" TEXT;

-- Combine firstName and lastName into displayName for existing records
UPDATE "users" 
SET "displayName" = CONCAT("firstName", ' ', "lastName") 
WHERE "displayName" IS NULL;

-- Make displayName NOT NULL
ALTER TABLE "users" ALTER COLUMN "displayName" SET NOT NULL;

-- Drop the old columns
ALTER TABLE "users" DROP COLUMN "firstName";
ALTER TABLE "users" DROP COLUMN "lastName";
