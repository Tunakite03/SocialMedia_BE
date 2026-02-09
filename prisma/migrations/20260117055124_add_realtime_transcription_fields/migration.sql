-- AlterTable
ALTER TABLE "call_transcripts" ADD COLUMN     "endTime" DOUBLE PRECISION,
ADD COLUMN     "isFinal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "segmentId" TEXT,
ADD COLUMN     "sentiment" "SentimentType",
ADD COLUMN     "startTime" DOUBLE PRECISION,
ADD COLUMN     "words" JSONB;

-- CreateIndex
CREATE INDEX "call_transcripts_callId_isFinal_timestamp_idx" ON "call_transcripts"("callId", "isFinal", "timestamp");

-- CreateIndex
CREATE INDEX "call_transcripts_segmentId_idx" ON "call_transcripts"("segmentId");
