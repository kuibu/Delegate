-- CreateEnum
CREATE TYPE "WorkflowKind" AS ENUM ('HANDOFF_FOLLOW_UP', 'APPROVAL_EXPIRATION');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EventType" ADD VALUE 'WORKFLOW_ENQUEUED';
ALTER TYPE "EventType" ADD VALUE 'WORKFLOW_COMPLETED';
ALTER TYPE "EventType" ADD VALUE 'WORKFLOW_FAILED';

-- CreateTable
CREATE TABLE "WorkflowRun" (
    "id" TEXT NOT NULL,
    "representativeId" TEXT NOT NULL,
    "contactId" TEXT,
    "conversationId" TEXT,
    "handoffRequestId" TEXT,
    "approvalRequestId" TEXT,
    "kind" "WorkflowKind" NOT NULL,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'QUEUED',
    "dedupeKey" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowRun_dedupeKey_key" ON "WorkflowRun"("dedupeKey");

-- CreateIndex
CREATE INDEX "WorkflowRun_representativeId_scheduledAt_idx" ON "WorkflowRun"("representativeId", "scheduledAt");

-- CreateIndex
CREATE INDEX "WorkflowRun_status_scheduledAt_idx" ON "WorkflowRun"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "WorkflowRun_handoffRequestId_idx" ON "WorkflowRun"("handoffRequestId");

-- CreateIndex
CREATE INDEX "WorkflowRun_approvalRequestId_idx" ON "WorkflowRun"("approvalRequestId");

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "Representative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_handoffRequestId_fkey" FOREIGN KEY ("handoffRequestId") REFERENCES "HandoffRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_approvalRequestId_fkey" FOREIGN KEY ("approvalRequestId") REFERENCES "ApprovalRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
