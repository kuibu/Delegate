-- CreateEnum
CREATE TYPE "WorkflowEngine" AS ENUM ('LOCAL_RUNNER', 'TEMPORAL');

-- AlterTable
ALTER TABLE "WorkflowRun" ADD COLUMN     "engine" "WorkflowEngine" NOT NULL DEFAULT 'LOCAL_RUNNER',
ADD COLUMN     "externalWorkflowId" TEXT,
ADD COLUMN     "queueName" TEXT;

-- CreateIndex
CREATE INDEX "WorkflowRun_engine_status_scheduledAt_idx" ON "WorkflowRun"("engine", "status", "scheduledAt");
