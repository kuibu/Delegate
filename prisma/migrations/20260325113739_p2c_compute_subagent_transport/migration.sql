-- AlterTable
ALTER TABLE "ComputeSession" ADD COLUMN     "subagentId" TEXT;

-- AlterTable
ALTER TABLE "ToolExecution" ADD COLUMN     "subagentId" TEXT;
