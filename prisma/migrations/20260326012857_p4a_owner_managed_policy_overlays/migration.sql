-- CreateEnum
CREATE TYPE "ManagedPolicyScope" AS ENUM ('REPRESENTATIVE_DEFAULT', 'DELEGATE_MANAGED', 'OWNER_MANAGED', 'CUSTOMER_TRUST_TIER');

-- CreateEnum
CREATE TYPE "PolicyResourceScope" AS ENUM ('WORKSPACE', 'REMOTE_MCP', 'BROWSER_LANE', 'ARTIFACT_STORE');

-- DropForeignKey
ALTER TABLE "CapabilityPolicyProfile" DROP CONSTRAINT "CapabilityPolicyProfile_representativeId_fkey";

-- AlterTable
ALTER TABLE "CapabilityPolicyProfile" ADD COLUMN     "contactTrustTierCondition" TEXT,
ADD COLUMN     "editableByOwner" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "managedScope" "ManagedPolicyScope" NOT NULL DEFAULT 'REPRESENTATIVE_DEFAULT',
ADD COLUMN     "ownerId" TEXT,
ALTER COLUMN "representativeId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CapabilityPolicyRule" ADD COLUMN     "resourceScopeCondition" "PolicyResourceScope";

-- CreateIndex
CREATE INDEX "CapabilityPolicyProfile_ownerId_managedScope_enabled_idx" ON "CapabilityPolicyProfile"("ownerId", "managedScope", "enabled");

-- AddForeignKey
ALTER TABLE "CapabilityPolicyProfile" ADD CONSTRAINT "CapabilityPolicyProfile_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "Representative"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapabilityPolicyProfile" ADD CONSTRAINT "CapabilityPolicyProfile_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
