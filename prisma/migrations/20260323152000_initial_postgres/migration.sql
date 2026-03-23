-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('PRIVATE_CHAT', 'GROUP_MENTION', 'GROUP_REPLY', 'CHANNEL_ENTRY');

-- CreateEnum
CREATE TYPE "PricingPlanType" AS ENUM ('FREE', 'PASS', 'DEEP_HELP', 'SPONSOR');

-- CreateEnum
CREATE TYPE "AudienceRole" AS ENUM ('LEAD', 'PARTNER', 'CANDIDATE', 'MEDIA', 'COMMUNITY', 'OTHER');

-- CreateEnum
CREATE TYPE "ContactStage" AS ENUM ('NEW', 'QUALIFIED', 'PENDING_PAYMENT', 'WAITING_ON_OWNER', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "GroupActivation" AS ENUM ('MENTION_ONLY', 'REPLY_OR_MENTION', 'ALWAYS');

-- CreateEnum
CREATE TYPE "SkillPackSource" AS ENUM ('BUILTIN', 'OWNER_UPLOAD', 'CLAWHUB');

-- CreateEnum
CREATE TYPE "HandoffStatus" AS ENUM ('OPEN', 'REVIEWING', 'ACCEPTED', 'DECLINED', 'CLOSED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'PAID', 'FULFILLED', 'REFUNDED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('MESSAGE_RECEIVED', 'MESSAGE_ANSWERED', 'INTAKE_STARTED', 'INTAKE_SUBMITTED', 'MATERIAL_SENT', 'PAYMENT_INVOICE_CREATED', 'PAYMENT_CONFIRMED', 'PAYMENT_REFUNDED', 'HANDOFF_REQUESTED', 'HANDOFF_RESOLVED');

-- CreateTable
CREATE TABLE "Owner" (
    "id" TEXT NOT NULL,
    "telegramUserId" TEXT,
    "displayName" TEXT NOT NULL,
    "handle" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Owner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "balanceCredits" INTEGER NOT NULL DEFAULT 0,
    "sponsorPoolCredit" INTEGER NOT NULL DEFAULT 0,
    "starsBalance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Representative" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "roleSummary" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "publicMode" BOOLEAN NOT NULL DEFAULT true,
    "groupModeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "groupActivation" "GroupActivation" NOT NULL DEFAULT 'REPLY_OR_MENTION',
    "humanInLoop" BOOLEAN NOT NULL DEFAULT true,
    "freeReplyLimit" INTEGER NOT NULL DEFAULT 4,
    "freeMonthlyCredit" INTEGER NOT NULL DEFAULT 100,
    "allowedSkills" JSONB NOT NULL,
    "actionGate" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Representative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgePack" (
    "id" TEXT NOT NULL,
    "representativeId" TEXT NOT NULL,
    "identitySummary" TEXT NOT NULL,
    "faq" JSONB NOT NULL,
    "materials" JSONB NOT NULL,
    "policies" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgePack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingPlan" (
    "id" TEXT NOT NULL,
    "representativeId" TEXT NOT NULL,
    "type" "PricingPlanType" NOT NULL,
    "name" TEXT NOT NULL,
    "starsAmount" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "includedReplies" INTEGER NOT NULL,
    "includesPriorityHandoff" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillPack" (
    "id" TEXT NOT NULL,
    "source" "SkillPackSource" NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "version" TEXT,
    "sourceUrl" TEXT,
    "ownerHandle" TEXT,
    "verificationTier" TEXT,
    "capabilityTags" JSONB NOT NULL,
    "executesCode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepresentativeSkillPack" (
    "id" TEXT NOT NULL,
    "representativeId" TEXT NOT NULL,
    "skillPackId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "installStatus" TEXT NOT NULL DEFAULT 'available',
    "installedVersion" TEXT,
    "installedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepresentativeSkillPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "representativeId" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "username" TEXT,
    "displayName" TEXT,
    "role" "AudienceRole" NOT NULL DEFAULT 'OTHER',
    "stage" "ContactStage" NOT NULL DEFAULT 'NEW',
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "representativeId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "telegramChatId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'ACTIVE',
    "freeRepliesUsed" INTEGER NOT NULL DEFAULT 0,
    "passUnlockedAt" TIMESTAMP(3),
    "deepHelpUnlockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationTurn" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "messageText" TEXT NOT NULL,
    "intent" TEXT,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationTurn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeSubmission" (
    "id" TEXT NOT NULL,
    "representativeId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "conversationId" TEXT,
    "requestType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "priorityScore" INTEGER NOT NULL DEFAULT 0,
    "recommendedNextStep" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntakeSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandoffRequest" (
    "id" TEXT NOT NULL,
    "representativeId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "conversationId" TEXT,
    "intakeSubmissionId" TEXT,
    "reason" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "recommendedPriority" INTEGER NOT NULL DEFAULT 0,
    "recommendedOwnerAction" TEXT NOT NULL,
    "status" "HandoffStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HandoffRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "representativeId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "conversationId" TEXT,
    "planType" "PricingPlanType" NOT NULL,
    "title" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "starsAmount" INTEGER NOT NULL,
    "invoiceLink" TEXT,
    "telegramPaymentChargeId" TEXT,
    "providerPaymentChargeId" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventAudit" (
    "id" TEXT NOT NULL,
    "representativeId" TEXT NOT NULL,
    "contactId" TEXT,
    "conversationId" TEXT,
    "type" "EventType" NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Owner_telegramUserId_key" ON "Owner"("telegramUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_ownerId_key" ON "Wallet"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Representative_slug_key" ON "Representative"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgePack_representativeId_key" ON "KnowledgePack"("representativeId");

-- CreateIndex
CREATE UNIQUE INDEX "SkillPack_source_slug_key" ON "SkillPack"("source", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "RepresentativeSkillPack_representativeId_skillPackId_key" ON "RepresentativeSkillPack"("representativeId", "skillPackId");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_representativeId_telegramUserId_key" ON "Contact"("representativeId", "telegramUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_representativeId_telegramChatId_contactId_key" ON "Conversation"("representativeId", "telegramChatId", "contactId");

-- CreateIndex
CREATE INDEX "HandoffRequest_representativeId_status_createdAt_idx" ON "HandoffRequest"("representativeId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_payload_key" ON "Invoice"("payload");

-- CreateIndex
CREATE INDEX "Invoice_representativeId_status_createdAt_idx" ON "Invoice"("representativeId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Representative" ADD CONSTRAINT "Representative_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgePack" ADD CONSTRAINT "KnowledgePack_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "Representative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingPlan" ADD CONSTRAINT "PricingPlan_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "Representative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepresentativeSkillPack" ADD CONSTRAINT "RepresentativeSkillPack_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "Representative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepresentativeSkillPack" ADD CONSTRAINT "RepresentativeSkillPack_skillPackId_fkey" FOREIGN KEY ("skillPackId") REFERENCES "SkillPack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "Representative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "Representative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationTurn" ADD CONSTRAINT "ConversationTurn_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeSubmission" ADD CONSTRAINT "IntakeSubmission_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "Representative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeSubmission" ADD CONSTRAINT "IntakeSubmission_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeSubmission" ADD CONSTRAINT "IntakeSubmission_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoffRequest" ADD CONSTRAINT "HandoffRequest_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "Representative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoffRequest" ADD CONSTRAINT "HandoffRequest_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoffRequest" ADD CONSTRAINT "HandoffRequest_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoffRequest" ADD CONSTRAINT "HandoffRequest_intakeSubmissionId_fkey" FOREIGN KEY ("intakeSubmissionId") REFERENCES "IntakeSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "Representative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAudit" ADD CONSTRAINT "EventAudit_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "Representative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAudit" ADD CONSTRAINT "EventAudit_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAudit" ADD CONSTRAINT "EventAudit_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

