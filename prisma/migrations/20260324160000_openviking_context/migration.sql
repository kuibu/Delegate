-- AlterTable
ALTER TABLE "Representative"
ADD COLUMN     "openvikingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "openvikingAgentId" TEXT,
ADD COLUMN     "openvikingAutoRecall" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "openvikingAutoCapture" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "openvikingCaptureMode" TEXT NOT NULL DEFAULT 'semantic',
ADD COLUMN     "openvikingRecallLimit" INTEGER NOT NULL DEFAULT 6,
ADD COLUMN     "openvikingRecallScoreThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.01,
ADD COLUMN     "openvikingTargetUri" TEXT,
ADD COLUMN     "openvikingLastSyncAt" TIMESTAMP(3),
ADD COLUMN     "openvikingLastSyncStatus" TEXT,
ADD COLUMN     "openvikingLastSyncError" TEXT,
ADD COLUMN     "openvikingLastSyncItemCount" INTEGER;

-- AlterTable
ALTER TABLE "Conversation"
ADD COLUMN     "openvikingSessionId" TEXT,
ADD COLUMN     "openvikingSessionKey" TEXT;

-- CreateTable
CREATE TABLE "RepresentativeContextSync" (
    "id" TEXT NOT NULL,
    "representativeId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepresentativeContextSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationRecallTrace" (
    "id" TEXT NOT NULL,
    "representativeId" TEXT NOT NULL,
    "conversationId" TEXT,
    "contactId" TEXT,
    "queryText" TEXT NOT NULL,
    "recalledUri" TEXT NOT NULL,
    "contextType" TEXT NOT NULL,
    "layer" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationRecallTrace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationCommitTrace" (
    "id" TEXT NOT NULL,
    "representativeId" TEXT NOT NULL,
    "conversationId" TEXT,
    "contactId" TEXT,
    "sessionId" TEXT NOT NULL,
    "sessionKey" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "memoriesExtracted" INTEGER,
    "archived" BOOLEAN,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationCommitTrace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpenVikingMemoryRecord" (
    "id" TEXT NOT NULL,
    "representativeId" TEXT NOT NULL,
    "contactId" TEXT,
    "uri" TEXT NOT NULL,
    "contextType" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "sourceKind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpenVikingMemoryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_openvikingSessionId_key" ON "Conversation"("openvikingSessionId");

-- CreateIndex
CREATE INDEX "RepresentativeContextSync_representativeId_createdAt_idx" ON "RepresentativeContextSync"("representativeId", "createdAt");

-- CreateIndex
CREATE INDEX "ConversationRecallTrace_representativeId_createdAt_idx" ON "ConversationRecallTrace"("representativeId", "createdAt");

-- CreateIndex
CREATE INDEX "ConversationRecallTrace_conversationId_createdAt_idx" ON "ConversationRecallTrace"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "ConversationCommitTrace_representativeId_createdAt_idx" ON "ConversationCommitTrace"("representativeId", "createdAt");

-- CreateIndex
CREATE INDEX "ConversationCommitTrace_conversationId_createdAt_idx" ON "ConversationCommitTrace"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OpenVikingMemoryRecord_uri_key" ON "OpenVikingMemoryRecord"("uri");

-- CreateIndex
CREATE INDEX "OpenVikingMemoryRecord_representativeId_createdAt_idx" ON "OpenVikingMemoryRecord"("representativeId", "createdAt");

-- CreateIndex
CREATE INDEX "OpenVikingMemoryRecord_representativeId_contactId_createdAt_idx" ON "OpenVikingMemoryRecord"("representativeId", "contactId", "createdAt");

-- AddForeignKey
ALTER TABLE "RepresentativeContextSync" ADD CONSTRAINT "RepresentativeContextSync_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "Representative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationRecallTrace" ADD CONSTRAINT "ConversationRecallTrace_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "Representative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationRecallTrace" ADD CONSTRAINT "ConversationRecallTrace_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationRecallTrace" ADD CONSTRAINT "ConversationRecallTrace_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationCommitTrace" ADD CONSTRAINT "ConversationCommitTrace_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "Representative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationCommitTrace" ADD CONSTRAINT "ConversationCommitTrace_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationCommitTrace" ADD CONSTRAINT "ConversationCommitTrace_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenVikingMemoryRecord" ADD CONSTRAINT "OpenVikingMemoryRecord_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "Representative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenVikingMemoryRecord" ADD CONSTRAINT "OpenVikingMemoryRecord_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
