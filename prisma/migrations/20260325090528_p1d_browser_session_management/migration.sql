-- CreateEnum
CREATE TYPE "BrowserTransportKind" AS ENUM ('PLAYWRIGHT', 'OPENAI_COMPUTER', 'CLAUDE_COMPUTER_USE');

-- CreateEnum
CREATE TYPE "BrowserSessionStatus" AS ENUM ('ACTIVE', 'FAILED', 'CLOSED');

-- CreateEnum
CREATE TYPE "BrowserNavigationStatus" AS ENUM ('SUCCEEDED', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EventType" ADD VALUE 'BROWSER_NAVIGATION_RECORDED';
ALTER TYPE "EventType" ADD VALUE 'BROWSER_SESSION_CLOSED';

-- CreateTable
CREATE TABLE "BrowserSession" (
    "id" TEXT NOT NULL,
    "representativeId" TEXT NOT NULL,
    "contactId" TEXT,
    "conversationId" TEXT,
    "computeSessionId" TEXT NOT NULL,
    "status" "BrowserSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "transportKind" "BrowserTransportKind" NOT NULL DEFAULT 'PLAYWRIGHT',
    "profilePath" TEXT,
    "currentUrl" TEXT,
    "currentTitle" TEXT,
    "lastToolExecutionId" TEXT,
    "lastNavigationAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrowserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrowserNavigation" (
    "id" TEXT NOT NULL,
    "browserSessionId" TEXT NOT NULL,
    "representativeId" TEXT NOT NULL,
    "contactId" TEXT,
    "conversationId" TEXT,
    "toolExecutionId" TEXT NOT NULL,
    "status" "BrowserNavigationStatus" NOT NULL,
    "transportKind" "BrowserTransportKind" NOT NULL DEFAULT 'PLAYWRIGHT',
    "requestedUrl" TEXT NOT NULL,
    "finalUrl" TEXT,
    "pageTitle" TEXT,
    "textSnippet" TEXT,
    "screenshotArtifactId" TEXT,
    "jsonArtifactId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrowserNavigation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrowserSession_computeSessionId_key" ON "BrowserSession"("computeSessionId");

-- CreateIndex
CREATE INDEX "BrowserSession_representativeId_updatedAt_idx" ON "BrowserSession"("representativeId", "updatedAt");

-- CreateIndex
CREATE INDEX "BrowserSession_conversationId_updatedAt_idx" ON "BrowserSession"("conversationId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BrowserNavigation_toolExecutionId_key" ON "BrowserNavigation"("toolExecutionId");

-- CreateIndex
CREATE INDEX "BrowserNavigation_browserSessionId_createdAt_idx" ON "BrowserNavigation"("browserSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "BrowserNavigation_representativeId_createdAt_idx" ON "BrowserNavigation"("representativeId", "createdAt");

-- AddForeignKey
ALTER TABLE "BrowserSession" ADD CONSTRAINT "BrowserSession_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "Representative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrowserSession" ADD CONSTRAINT "BrowserSession_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrowserSession" ADD CONSTRAINT "BrowserSession_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrowserSession" ADD CONSTRAINT "BrowserSession_computeSessionId_fkey" FOREIGN KEY ("computeSessionId") REFERENCES "ComputeSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrowserNavigation" ADD CONSTRAINT "BrowserNavigation_browserSessionId_fkey" FOREIGN KEY ("browserSessionId") REFERENCES "BrowserSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrowserNavigation" ADD CONSTRAINT "BrowserNavigation_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "Representative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrowserNavigation" ADD CONSTRAINT "BrowserNavigation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrowserNavigation" ADD CONSTRAINT "BrowserNavigation_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrowserNavigation" ADD CONSTRAINT "BrowserNavigation_toolExecutionId_fkey" FOREIGN KEY ("toolExecutionId") REFERENCES "ToolExecution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
