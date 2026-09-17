ALTER TABLE "JobLead" ADD COLUMN "industry" TEXT;

ALTER TABLE "Application" ADD COLUMN "usedResumeId" TEXT;

ALTER TABLE "Application"
ADD CONSTRAINT "Application_usedResumeId_fkey"
FOREIGN KEY ("usedResumeId") REFERENCES "Resume"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Application_usedResumeId_idx" ON "Application"("usedResumeId");
