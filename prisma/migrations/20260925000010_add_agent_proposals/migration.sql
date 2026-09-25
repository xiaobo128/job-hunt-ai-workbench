CREATE TYPE "AgentProposalType" AS ENUM ('APPLICATION_STATUS_UPDATE', 'APPLICATION_EVENT_APPEND');
CREATE TYPE "AgentProposalStatus" AS ENUM ('PENDING', 'CONFIRMED', 'EXECUTED', 'REJECTED');

CREATE TABLE "AgentProposal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "type" "AgentProposalType" NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceIdentifier" TEXT,
    "evidenceText" TEXT NOT NULL,
    "status" "AgentProposalStatus" NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentProposal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AgentProposal_userId_status_createdAt_idx" ON "AgentProposal"("userId", "status", "createdAt");
CREATE INDEX "AgentProposal_applicationId_idx" ON "AgentProposal"("applicationId");

ALTER TABLE "AgentProposal" ADD CONSTRAINT "AgentProposal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentProposal" ADD CONSTRAINT "AgentProposal_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
