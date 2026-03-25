-- AlterEnum
ALTER TYPE "LedgerEntryKind" ADD VALUE 'MCP_CALLS';

-- AlterTable
ALTER TABLE "ApprovalRequest" ADD COLUMN     "subagentId" TEXT;

-- AlterTable
ALTER TABLE "RepresentativeMcpBinding" ADD COLUMN     "estimatedCostCentsPerCall" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "WorkflowRun" ADD COLUMN     "subagentId" TEXT;
