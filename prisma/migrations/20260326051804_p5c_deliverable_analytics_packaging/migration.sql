-- AlterTable
ALTER TABLE "Deliverable" ADD COLUMN     "downloadCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastDownloadedAt" TIMESTAMP(3),
ADD COLUMN     "packageBuiltAt" TIMESTAMP(3),
ADD COLUMN     "packageCacheKey" TEXT,
ADD COLUMN     "packageMimeType" TEXT,
ADD COLUMN     "packageObjectKey" TEXT,
ADD COLUMN     "packageSha256" TEXT,
ADD COLUMN     "packageSizeBytes" INTEGER;

-- CreateIndex
CREATE INDEX "Deliverable_representativeId_sourceKind_packageBuiltAt_idx" ON "Deliverable"("representativeId", "sourceKind", "packageBuiltAt");
