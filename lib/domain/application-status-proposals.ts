import type { ApplicationStage } from "@prisma/client";

export type ApplicationStatusProposalInput = {
  applicationId: string;
  requestedStage: ApplicationStage;
  note?: string;
  nextAction?: string;
  submissionChannel?: string;
};

type ApplicationStatusProposalDependencies = {
  findOwnedApplication: (input: { userId: string; applicationId: string }) => Promise<{
    id: string;
    currentStage: ApplicationStage;
    jobLead: { companyName: string; roleTitle: string };
  } | null>;
  createProposal: (input: {
    userId: string;
    input: {
      applicationId: string;
      type: "APPLICATION_STATUS_UPDATE";
      payload: {
        requestedStage: ApplicationStage;
        note?: string;
        nextAction?: string;
        submissionChannel?: string;
      };
      source: { type: "AGENT_STATUS_UPDATE"; identifier: null; evidenceText: string };
    };
  }) => Promise<{ id: string; status: string }>;
};

export class ApplicationStatusProposalError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "APPLICATION_CLOSED") {
    super(code);
    this.name = "ApplicationStatusProposalError";
  }
}

export async function proposeApplicationStatusUpdate({
  userId,
  input,
  dependencies
}: {
  userId: string;
  input: ApplicationStatusProposalInput;
  dependencies: ApplicationStatusProposalDependencies;
}) {
  const application = await dependencies.findOwnedApplication({ userId, applicationId: input.applicationId });
  if (!application) throw new ApplicationStatusProposalError("NOT_FOUND");
  if (application.currentStage === "CLOSED" || application.currentStage === "REJECTED") {
    throw new ApplicationStatusProposalError("APPLICATION_CLOSED");
  }

  const proposal = await dependencies.createProposal({
    userId,
    input: {
      applicationId: application.id,
      type: "APPLICATION_STATUS_UPDATE",
      payload: {
        requestedStage: input.requestedStage,
        ...(input.note !== undefined ? { note: input.note } : {}),
        ...(input.nextAction !== undefined ? { nextAction: input.nextAction } : {}),
        ...(input.submissionChannel !== undefined ? { submissionChannel: input.submissionChannel } : {})
      },
      source: {
        type: "AGENT_STATUS_UPDATE",
        identifier: null,
        evidenceText: `Agent suggested changing application ${application.id} from ${application.currentStage} to ${input.requestedStage}.`
      }
    }
  });

  return {
    proposalId: proposal.id,
    status: proposal.status,
    applicationId: application.id,
    companyName: application.jobLead.companyName,
    roleTitle: application.jobLead.roleTitle,
    currentStage: application.currentStage,
    requestedStage: input.requestedStage,
    confirmationRequired: true as const
  };
}
