-- CreateEnum
CREATE TYPE "CapabilityKind" AS ENUM ('EXEC', 'READ', 'WRITE', 'PROCESS', 'BROWSER');

-- CreateEnum
CREATE TYPE "PolicyDecision" AS ENUM ('ALLOW', 'ASK', 'DENY');

-- CreateEnum
CREATE TYPE "ComputeSessionStatus" AS ENUM ('REQUESTED', 'STARTING', 'RUNNING', 'IDLE', 'STOPPING', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ToolExecutionStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'BLOCKED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ArtifactKind" AS ENUM ('STDOUT', 'STDERR', 'FILE', 'ARCHIVE', 'SCREENSHOT', 'JSON', 'TRACE');

-- CreateEnum
CREATE TYPE "LedgerEntryKind" AS ENUM ('MODEL_USAGE', 'COMPUTE_MINUTES', 'STORAGE_BYTES', 'ARTIFACT_EGRESS', 'BROWSER_MINUTES', 'PLAN_DEBIT', 'SPONSOR_CREDIT');

-- CreateEnum
CREATE TYPE "ComputeRequestedBy" AS ENUM ('SYSTEM', 'OWNER', 'AUDIENCE');

-- CreateEnum
CREATE TYPE "ComputeRunnerType" AS ENUM ('DOCKER', 'VM');

-- CreateEnum
CREATE TYPE "ComputeNetworkMode" AS ENUM ('NO_NETWORK', 'ALLOWLIST', 'FULL');

-- CreateEnum
CREATE TYPE "ComputeFilesystemMode" AS ENUM ('WORKSPACE_ONLY', 'READ_ONLY_WORKSPACE', 'EPHEMERAL_FULL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EventType" ADD VALUE 'COMPUTE_SESSION_REQUESTED';
ALTER TYPE "EventType" ADD VALUE 'COMPUTE_SESSION_STARTED';
ALTER TYPE "EventType" ADD VALUE 'COMPUTE_SESSION_TERMINATED';
ALTER TYPE "EventType" ADD VALUE 'TOOL_EXECUTION_REQUESTED';
ALTER TYPE "EventType" ADD VALUE 'TOOL_EXECUTION_BLOCKED';
ALTER TYPE "EventType" ADD VALUE 'TOOL_EXECUTION_COMPLETED';
ALTER TYPE "EventType" ADD VALUE 'APPROVAL_REQUESTED';
ALTER TYPE "EventType" ADD VALUE 'APPROVAL_RESOLVED';
ALTER TYPE "EventType" ADD VALUE 'ARTIFACT_STORED';
ALTER TYPE "EventType" ADD VALUE 'BILLING_LEDGER_RECORDED';

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "computeTrustTier" TEXT,
ADD COLUMN     "lastApprovalGrantedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "activeComputeSessionId" TEXT,
ADD COLUMN     "computeBudgetRemainingCredits" INTEGER,
ADD COLUMN     "lastComputeAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Representative" ADD COLUMN     "computeArtifactRetentionDays" INTEGER NOT NULL DEFAULT 14,
ADD COLUMN     "computeAutoApproveBudgetCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "computeBaseImage" TEXT NOT NULL DEFAULT 'delegate/compute-runner:phase-a',
ADD COLUMN     "computeDefaultPolicyMode" "PolicyDecision" NOT NULL DEFAULT 'ASK',
ADD COLUMN     "computeEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "computeFilesystemMode" "ComputeFilesystemMode" NOT NULL DEFAULT 'WORKSPACE_ONLY',
ADD COLUMN     "computeMaxSessionMinutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "computeNetworkMode" "ComputeNetworkMode" NOT NULL DEFAULT 'NO_NETWORK',
ALTER COLUMN "languages" DROP DEFAULT,
ALTER COLUMN "freeScope" DROP DEFAULT,
ALTER COLUMN "paywalledIntents" DROP DEFAULT,
ALTER COLUMN "handoffPrompt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "CapabilityPolicyProfile" (
    "id" TEXT NOT NULL,
    "representativeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "defaultDecision" "PolicyDecision" NOT NULL DEFAULT 'ASK',
    "maxSessionMinutes" INTEGER NOT NULL DEFAULT 15,
    "maxParallelSessions" INTEGER NOT NULL DEFAULT 1,
    "maxCommandSeconds" INTEGER NOT NULL DEFAULT 30,
    "artifactRetentionDays" INTEGER NOT NULL DEFAULT 14,
    "networkMode" "ComputeNetworkMode" NOT NULL DEFAULT 'NO_NETWORK',
    "filesystemMode" "ComputeFilesystemMode" NOT NULL DEFAULT 'WORKSPACE_ONLY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapabilityPolicyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapabilityPolicyRule" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "capability" "CapabilityKind" NOT NULL,
    "decision" "PolicyDecision" NOT NULL,
    "commandPattern" TEXT,
    "pathPattern" TEXT,
    "domainPattern" TEXT,
    "maxCostCents" INTEGER,
    "requiresPaidPlan" BOOLEAN NOT NULL DEFAULT false,
    "requiresHumanApproval" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapabilityPolicyRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComputeSession" (
    "id" TEXT NOT NULL,
    "representativeId" TEXT NOT NULL,
    "contactId" TEXT,
    "conversationId" TEXT,
    "policyProfileId" TEXT,
    "requestedBy" "ComputeRequestedBy" NOT NULL,
    "status" "ComputeSessionStatus" NOT NULL DEFAULT 'REQUESTED',
    "containerId" TEXT,
    "runnerType" "ComputeRunnerType" NOT NULL DEFAULT 'DOCKER',
    "baseImage" TEXT NOT NULL,
    "leaseTokenHash" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "lastHeartbeatAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComputeSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolExecution" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "capability" "CapabilityKind" NOT NULL,
    "status" "ToolExecutionStatus" NOT NULL DEFAULT 'QUEUED',
    "requestedCommand" TEXT,
    "requestedPath" TEXT,
    "workingDirectory" TEXT,
    "policyDecision" "PolicyDecision",
    "approvalRequestId" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "exitCode" INTEGER,
    "cpuMs" INTEGER,
    "wallMs" INTEGER,
    "bytesRead" INTEGER,
    "bytesWritten" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "representativeId" TEXT NOT NULL,
    "contactId" TEXT,
    "conversationId" TEXT,
    "sessionId" TEXT,
    "toolExecutionId" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "requestedActionSummary" TEXT NOT NULL,
    "riskSummary" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Artifact" (
    "id" TEXT NOT NULL,
    "representativeId" TEXT NOT NULL,
    "contactId" TEXT,
    "conversationId" TEXT,
    "sessionId" TEXT,
    "toolExecutionId" TEXT,
    "kind" "ArtifactKind" NOT NULL,
    "bucket" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "retentionUntil" TIMESTAMP(3),
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Artifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "representativeId" TEXT NOT NULL,
    "contactId" TEXT,
    "conversationId" TEXT,
    "sessionId" TEXT,
    "toolExecutionId" TEXT,
    "invoiceId" TEXT,
    "kind" "LedgerEntryKind" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "creditDelta" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CapabilityPolicyProfile_representativeId_isDefault_idx" ON "CapabilityPolicyProfile"("representativeId", "isDefault");

-- CreateIndex
CREATE INDEX "CapabilityPolicyRule_profileId_capability_priority_idx" ON "CapabilityPolicyRule"("profileId", "capability", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "ComputeSession_leaseTokenHash_key" ON "ComputeSession"("leaseTokenHash");

-- CreateIndex
CREATE INDEX "ComputeSession_representativeId_status_createdAt_idx" ON "ComputeSession"("representativeId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ComputeSession_contactId_createdAt_idx" ON "ComputeSession"("contactId", "createdAt");

-- CreateIndex
CREATE INDEX "ComputeSession_conversationId_createdAt_idx" ON "ComputeSession"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "ToolExecution_sessionId_createdAt_idx" ON "ToolExecution"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "ToolExecution_status_createdAt_idx" ON "ToolExecution"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalRequest_toolExecutionId_key" ON "ApprovalRequest"("toolExecutionId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_representativeId_status_requestedAt_idx" ON "ApprovalRequest"("representativeId", "status", "requestedAt");

-- CreateIndex
CREATE INDEX "Artifact_representativeId_createdAt_idx" ON "Artifact"("representativeId", "createdAt");

-- CreateIndex
CREATE INDEX "Artifact_sessionId_createdAt_idx" ON "Artifact"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_representativeId_createdAt_idx" ON "LedgerEntry"("representativeId", "createdAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_sessionId_createdAt_idx" ON "LedgerEntry"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_kind_createdAt_idx" ON "LedgerEntry"("kind", "createdAt");

-- AddForeignKey
ALTER TABLE "CapabilityPolicyProfile" ADD CONSTRAINT "CapabilityPolicyProfile_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "Representative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapabilityPolicyRule" ADD CONSTRAINT "CapabilityPolicyRule_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CapabilityPolicyProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComputeSession" ADD CONSTRAINT "ComputeSession_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "Representative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComputeSession" ADD CONSTRAINT "ComputeSession_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComputeSession" ADD CONSTRAINT "ComputeSession_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComputeSession" ADD CONSTRAINT "ComputeSession_policyProfileId_fkey" FOREIGN KEY ("policyProfileId") REFERENCES "CapabilityPolicyProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolExecution" ADD CONSTRAINT "ToolExecution_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ComputeSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "Representative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ComputeSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "Representative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ComputeSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_toolExecutionId_fkey" FOREIGN KEY ("toolExecutionId") REFERENCES "ToolExecution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "Representative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ComputeSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
