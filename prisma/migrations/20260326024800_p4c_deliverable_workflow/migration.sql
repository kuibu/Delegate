-- CreateEnum
CREATE TYPE "DeliverableKind" AS ENUM ('DECK', 'CASE_STUDY', 'DOWNLOAD', 'GENERATED_DOCUMENT', 'PACKAGE');

-- CreateEnum
CREATE TYPE "DeliverableVisibility" AS ENUM ('OWNER_ONLY', 'PUBLIC_MATERIAL');

-- CreateEnum
CREATE TYPE "DeliverableSourceKind" AS ENUM ('ARTIFACT', 'EXTERNAL_LINK', 'BUNDLE');

-- CreateTable
CREATE TABLE "Deliverable" (
    "id" TEXT NOT NULL,
    "representativeId" TEXT NOT NULL,
    "artifactId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "kind" "DeliverableKind" NOT NULL,
    "visibility" "DeliverableVisibility" NOT NULL DEFAULT 'OWNER_ONLY',
    "sourceKind" "DeliverableSourceKind" NOT NULL,
    "externalUrl" TEXT,
    "bundleItemArtifactIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deliverable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Deliverable_representativeId_visibility_createdAt_idx" ON "Deliverable"("representativeId", "visibility", "createdAt");

-- CreateIndex
CREATE INDEX "Deliverable_artifactId_idx" ON "Deliverable"("artifactId");

-- AddForeignKey
ALTER TABLE "Deliverable" ADD CONSTRAINT "Deliverable_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "Representative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deliverable" ADD CONSTRAINT "Deliverable_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "Artifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
