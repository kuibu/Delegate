-- CreateEnum
CREATE TYPE "CapabilityPlanTier" AS ENUM ('PASS', 'DEEP_HELP');

-- AlterTable
ALTER TABLE "CapabilityPolicyProfile" ADD COLUMN     "isManaged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "managedSource" TEXT,
ADD COLUMN     "precedence" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "CapabilityPolicyRule" ADD COLUMN     "channelCondition" "Channel",
ADD COLUMN     "requiredPlanTier" "CapabilityPlanTier";
