-- CreateEnum
CREATE TYPE "WorkflowEnginePhase" AS ENUM (
    'DISPATCH_PENDING',
    'WAITING_TIMER',
    'ACTIVITY_RUNNING',
    'RETRY_BACKOFF',
    'CANCEL_REQUESTED',
    'COMPLETED',
    'FAILED',
    'CANCELED'
);

-- AlterTable
ALTER TABLE "WorkflowRun"
ADD COLUMN     "cancelRequestedAt" TIMESTAMP(3),
ADD COLUMN     "dispatchAttemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "enginePhase" "WorkflowEnginePhase",
ADD COLUMN     "externalRunId" TEXT,
ADD COLUMN     "lastEngineError" TEXT,
ADD COLUMN     "lastObservedAt" TIMESTAMP(3),
ADD COLUMN     "nextWakeAt" TIMESTAMP(3);
