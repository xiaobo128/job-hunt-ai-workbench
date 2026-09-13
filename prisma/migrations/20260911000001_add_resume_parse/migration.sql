-- CreateEnum
CREATE TYPE "ResumeParseStatus" AS ENUM ('PROCESSING', 'NEEDS_REVIEW', 'CONFIRMED', 'FAILED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "ResumeParse" (
    "id" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "resumeAssetId" TEXT NOT NULL,
    "status" "ResumeParseStatus" NOT NULL DEFAULT 'PROCESSING',
    "documentJson" JSONB,
    "schemaVersion" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "providerRequestId" TEXT,
    "qualityJson" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumeParse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResumeParse_resumeId_status_idx" ON "ResumeParse"("resumeId", "status");

-- CreateIndex
CREATE INDEX "ResumeParse_resumeAssetId_createdAt_idx" ON "ResumeParse"("resumeAssetId", "createdAt");

-- AddForeignKey
ALTER TABLE "ResumeParse" ADD CONSTRAINT "ResumeParse_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeParse" ADD CONSTRAINT "ResumeParse_resumeAssetId_fkey" FOREIGN KEY ("resumeAssetId") REFERENCES "ResumeAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
