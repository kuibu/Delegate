-- AlterTable
ALTER TABLE "CapabilityPolicyProfile" ADD COLUMN     "networkAllowlist" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Representative" ADD COLUMN     "computeNetworkAllowlist" TEXT[] DEFAULT ARRAY[]::TEXT[];
