-- CreateEnum
CREATE TYPE "WorkflowCommandType" AS ENUM ('START', 'CANCEL');

-- CreateTable
CREATE TABLE "WorkflowCommandOutbox" (
    "id" TEXT NOT NULL,
    "workflowRunId" TEXT NOT NULL,
    "commandType" "WorkflowCommandType" NOT NULL,
    "payload" JSONB,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowCommandOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkflowCommandOutbox_processedAt_availableAt_createdAt_idx" ON "WorkflowCommandOutbox"("processedAt", "availableAt", "createdAt");

-- CreateIndex
CREATE INDEX "WorkflowCommandOutbox_workflowRunId_commandType_processedAt_idx" ON "WorkflowCommandOutbox"("workflowRunId", "commandType", "processedAt");

-- AddForeignKey
ALTER TABLE "WorkflowCommandOutbox" ADD CONSTRAINT "WorkflowCommandOutbox_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "WorkflowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
