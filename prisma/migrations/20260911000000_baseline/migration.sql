-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('LINK', 'TEXT', 'SCREENSHOT', 'MANUAL');

-- CreateEnum
CREATE TYPE "ApplicationStage" AS ENUM ('INTERESTED', 'READY_TO_APPLY', 'APPLIED', 'ASSESSMENT', 'INTERVIEW', 'FIRST_INTERVIEW', 'SECOND_INTERVIEW', 'THIRD_INTERVIEW', 'FINAL_INTERVIEW', 'NEGOTIATION', 'OFFER', 'CLOSED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('NOTE', 'ASSESSMENT', 'INTERVIEW', 'OFFER', 'REJECTION', 'DEADLINE');

-- CreateEnum
CREATE TYPE "ResumeVariantSourceType" AS ENUM ('AI_DRAFT', 'MANUAL_UPLOAD');

-- CreateEnum
CREATE TYPE "ResumeAssetKind" AS ENUM ('PDF', 'DOCX', 'DOC', 'IMAGE', 'TEXT', 'OTHER');

-- CreateEnum
CREATE TYPE "ResumeAssetMatchStatus" AS ENUM ('UNCHECKED', 'MATCHED', 'POSSIBLE_MISMATCH');

-- CreateEnum
CREATE TYPE "AgentRunKind" AS ENUM ('JOB_IMPORT', 'STATUS_SYNC', 'RESUME_VARIANT_IMPORT', 'NOTIFICATION_IMPORT', 'TAILOR_REQUEST');

-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "AgentRunSource" AS ENUM ('MANUAL', 'API', 'WEBHOOK', 'INTERNAL_AI');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "resumeTailorWebhookUrl" TEXT,
    "statusSyncWebhookUrl" TEXT,
    "notificationWebhookUrl" TEXT,
    "webhookSecret" TEXT,
    "aiProvider" TEXT,
    "aiApiKey" TEXT,
    "aiApiBaseUrl" TEXT,
    "aiForwardHost" TEXT,
    "aiModel" TEXT,
    "aiVisionModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ApiToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobLead" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "parseProvider" TEXT,
    "parseNote" TEXT,
    "needsReview" BOOLEAN NOT NULL DEFAULT true,
    "reviewedAt" TIMESTAMP(3),
    "sourceType" "SourceType" NOT NULL,
    "sourceName" TEXT,
    "sourceUrl" TEXT,
    "artifactName" TEXT,
    "artifactUrl" TEXT,
    "artifactNamesJson" TEXT,
    "artifactUrlsJson" TEXT,
    "companyName" TEXT NOT NULL,
    "roleTitle" TEXT NOT NULL,
    "city" TEXT,
    "seniority" TEXT,
    "salaryRange" TEXT,
    "skills" TEXT NOT NULL,
    "responsibilities" TEXT NOT NULL,
    "requirements" TEXT NOT NULL,
    "rawContent" TEXT NOT NULL,
    "parsedSummary" TEXT,
    "status" "ApplicationStage" NOT NULL DEFAULT 'READY_TO_APPLY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "jobLeadId" TEXT NOT NULL,
    "currentStage" "ApplicationStage" NOT NULL DEFAULT 'READY_TO_APPLY',
    "appliedAt" TIMESTAMP(3),
    "submissionChannel" TEXT,
    "nextAction" TEXT,
    "nextActionDueAt" TIMESTAMP(3),
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resume" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rawText" TEXT,
    "note" TEXT,
    "fileUrl" TEXT,
    "artifactName" TEXT,
    "artifactMimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeAsset" (
    "id" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "kind" "ResumeAssetKind" NOT NULL,
    "matchStatus" "ResumeAssetMatchStatus" NOT NULL DEFAULT 'UNCHECKED',
    "isPreviewSource" BOOLEAN NOT NULL DEFAULT false,
    "isEditingSource" BOOLEAN NOT NULL DEFAULT false,
    "fileUrl" TEXT NOT NULL,
    "artifactName" TEXT NOT NULL,
    "artifactMimeType" TEXT,
    "extractedText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumeAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeVariant" (
    "id" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "jobLeadId" TEXT,
    "sourceType" "ResumeVariantSourceType" NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "fileUrl" TEXT,
    "artifactName" TEXT,
    "artifactMimeType" TEXT,
    "draftText" TEXT,
    "tailorRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumeVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeTailorRun" (
    "id" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "jobLeadId" TEXT NOT NULL,
    "aiProvider" TEXT,
    "aiNote" TEXT,
    "summary" TEXT NOT NULL,
    "draftTitle" TEXT,
    "draftText" TEXT,
    "suggestionsJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResumeTailorRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "aiProvider" TEXT,
    "aiNote" TEXT,
    "eventType" "EventType" NOT NULL,
    "eventTime" TIMESTAMP(3),
    "title" TEXT NOT NULL,
    "artifactName" TEXT,
    "artifactUrl" TEXT,
    "detailsJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "AgentRunKind" NOT NULL,
    "status" "AgentRunStatus" NOT NULL,
    "source" "AgentRunSource" NOT NULL,
    "inputJson" TEXT,
    "outputJson" TEXT,
    "errorMessage" TEXT,
    "jobLeadId" TEXT,
    "resumeId" TEXT,
    "resumeVariantId" TEXT,
    "eventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "ApiToken_tokenHash_key" ON "ApiToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Application_jobLeadId_key" ON "Application"("jobLeadId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiToken" ADD CONSTRAINT "ApiToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobLead" ADD CONSTRAINT "JobLead_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_jobLeadId_fkey" FOREIGN KEY ("jobLeadId") REFERENCES "JobLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeAsset" ADD CONSTRAINT "ResumeAsset_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeVariant" ADD CONSTRAINT "ResumeVariant_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeVariant" ADD CONSTRAINT "ResumeVariant_jobLeadId_fkey" FOREIGN KEY ("jobLeadId") REFERENCES "JobLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeTailorRun" ADD CONSTRAINT "ResumeTailorRun_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeTailorRun" ADD CONSTRAINT "ResumeTailorRun_jobLeadId_fkey" FOREIGN KEY ("jobLeadId") REFERENCES "JobLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_jobLeadId_fkey" FOREIGN KEY ("jobLeadId") REFERENCES "JobLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_resumeVariantId_fkey" FOREIGN KEY ("resumeVariantId") REFERENCES "ResumeVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
