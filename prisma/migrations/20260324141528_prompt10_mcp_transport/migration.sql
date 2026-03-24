-- CreateEnum
CREATE TYPE "McpTransportKind" AS ENUM ('STREAMABLE_HTTP');

-- AlterEnum
ALTER TYPE "CapabilityKind" ADD VALUE 'MCP';

-- AlterTable
ALTER TABLE "ToolExecution" ADD COLUMN     "mcpBindingId" TEXT,
ADD COLUMN     "requestPayload" JSONB;

-- CreateTable
CREATE TABLE "RepresentativeMcpBinding" (
    "id" TEXT NOT NULL,
    "representativeId" TEXT NOT NULL,
    "representativeSkillPackLinkId" TEXT,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "serverUrl" TEXT NOT NULL,
    "transportKind" "McpTransportKind" NOT NULL DEFAULT 'STREAMABLE_HTTP',
    "allowedToolNames" JSONB NOT NULL,
    "defaultToolName" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "approvalRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepresentativeMcpBinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RepresentativeMcpBinding_representativeId_enabled_createdAt_idx" ON "RepresentativeMcpBinding"("representativeId", "enabled", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RepresentativeMcpBinding_representativeId_slug_key" ON "RepresentativeMcpBinding"("representativeId", "slug");

-- CreateIndex
CREATE INDEX "ToolExecution_mcpBindingId_createdAt_idx" ON "ToolExecution"("mcpBindingId", "createdAt");

-- AddForeignKey
ALTER TABLE "RepresentativeMcpBinding" ADD CONSTRAINT "RepresentativeMcpBinding_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "Representative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepresentativeMcpBinding" ADD CONSTRAINT "RepresentativeMcpBinding_representativeSkillPackLinkId_fkey" FOREIGN KEY ("representativeSkillPackLinkId") REFERENCES "RepresentativeSkillPack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolExecution" ADD CONSTRAINT "ToolExecution_mcpBindingId_fkey" FOREIGN KEY ("mcpBindingId") REFERENCES "RepresentativeMcpBinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;
