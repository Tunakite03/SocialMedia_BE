-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "sentiment" "SentimentType",
ADD COLUMN     "sentimentConfidence" DOUBLE PRECISION,
ADD COLUMN     "sentimentScores" JSONB;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "sentiment" "SentimentType",
ADD COLUMN     "sentimentConfidence" DOUBLE PRECISION,
ADD COLUMN     "sentimentScores" JSONB;

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "sentiment" "SentimentType",
ADD COLUMN     "sentimentConfidence" DOUBLE PRECISION,
ADD COLUMN     "sentimentScores" JSONB;

-- CreateIndex
CREATE INDEX "comments_sentiment_idx" ON "comments"("sentiment");

-- CreateIndex
CREATE INDEX "messages_sentiment_idx" ON "messages"("sentiment");

-- CreateIndex
CREATE INDEX "posts_sentiment_idx" ON "posts"("sentiment");
