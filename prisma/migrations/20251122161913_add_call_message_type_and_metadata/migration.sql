-- AlterEnum
ALTER TYPE "MessageType" ADD VALUE 'CALL';

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "metadata" JSONB;
