-- AlterTable
ALTER TABLE "calls" ADD COLUMN     "livekitRoomId" TEXT,
ADD COLUMN     "roomName" TEXT;

-- CreateIndex
CREATE INDEX "calls_roomName_idx" ON "calls"("roomName");

-- CreateIndex
CREATE INDEX "calls_livekitRoomId_idx" ON "calls"("livekitRoomId");
