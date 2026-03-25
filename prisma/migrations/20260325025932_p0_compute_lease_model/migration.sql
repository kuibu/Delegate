-- CreateEnum
CREATE TYPE "ComputeLeaseStatus" AS ENUM ('REQUESTED', 'READY', 'RELEASING', 'RELEASED', 'FAILED');

-- AlterEnum
ALTER TYPE "EventType" ADD VALUE 'COMPUTE_SESSION_HEARTBEAT';

-- AlterTable
ALTER TABLE "ComputeSession" ADD COLUMN     "leaseAcquiredAt" TIMESTAMP(3),
ADD COLUMN     "leaseLastUsedAt" TIMESTAMP(3),
ADD COLUMN     "leaseReleasedAt" TIMESTAMP(3),
ADD COLUMN     "leaseStatus" "ComputeLeaseStatus" NOT NULL DEFAULT 'REQUESTED',
ADD COLUMN     "runnerLeaseId" TEXT;
