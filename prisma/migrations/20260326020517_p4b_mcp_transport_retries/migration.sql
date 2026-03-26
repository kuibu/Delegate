-- AlterEnum
ALTER TYPE "McpTransportKind" ADD VALUE 'SSE';

-- AlterTable
ALTER TABLE "RepresentativeMcpBinding" ADD COLUMN     "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastFailureAt" TIMESTAMP(3),
ADD COLUMN     "lastFailureReason" TEXT,
ADD COLUMN     "lastSuccessAt" TIMESTAMP(3),
ADD COLUMN     "maxRetries" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "retryBackoffMs" INTEGER NOT NULL DEFAULT 1000;
