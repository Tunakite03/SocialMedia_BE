-- CreateTable
CREATE TABLE "face_emotions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "callId" TEXT,
    "emotion" "SentimentType" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "face_emotions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "face_emotions_userId_timestamp_idx" ON "face_emotions"("userId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "face_emotions_callId_timestamp_idx" ON "face_emotions"("callId", "timestamp" DESC);

-- AddForeignKey
ALTER TABLE "face_emotions" ADD CONSTRAINT "face_emotions_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
