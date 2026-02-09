/*
  Warnings:

  - The values [POSITIVE,NEUTRAL,NEGATIVE] on the enum `SentimentType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "SentimentType_new" AS ENUM ('ENJOYMENT', 'SADNESS', 'ANGER', 'FEAR', 'DISGUST', 'SURPRISE', 'OTHER');
ALTER TABLE "posts" ALTER COLUMN "sentiment" TYPE "SentimentType_new" USING ("sentiment"::text::"SentimentType_new");
ALTER TABLE "comments" ALTER COLUMN "sentiment" TYPE "SentimentType_new" USING ("sentiment"::text::"SentimentType_new");
ALTER TABLE "messages" ALTER COLUMN "sentiment" TYPE "SentimentType_new" USING ("sentiment"::text::"SentimentType_new");
ALTER TABLE "sentiment_analyses" ALTER COLUMN "sentiment" TYPE "SentimentType_new" USING ("sentiment"::text::"SentimentType_new");
ALTER TYPE "SentimentType" RENAME TO "SentimentType_old";
ALTER TYPE "SentimentType_new" RENAME TO "SentimentType";
DROP TYPE "SentimentType_old";
COMMIT;
