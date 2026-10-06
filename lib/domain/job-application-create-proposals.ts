import { AgentProposalStatus, AgentProposalType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import {
  createAgentProposal,
  jobApplicationCreateProposalPayloadSchema,
  type JobApplicationCreatePayload
} from "./agent-proposals";

export type JobApplicationCreateProposalInput = z.input<typeof jobApplicationCreateProposalPayloadSchema>;

export type DuplicateJobApplication = {
  jobLeadId: string | null;
  applicationId: string | null;
  proposalId: string | null;
  companyName: string;
  roleTitle: string;
  sourceUrl: string | null;
};

export class JobApplicationCreateProposalError extends Error {
  constructor(public readonly code: "DUPLICATE_APPLICATION", public readonly duplicate: DuplicateJobApplication) {
    super(code);
    this.name = "JobApplicationCreateProposalError";
  }
}

type Dependencies = {
  findExisting: (input: { userId: string; payload: JobApplicationCreatePayload }) => Promise<DuplicateJobApplication | null>;
  findPending: (input: { userId: string }) => Promise<Array<{ id: string; payloadJson: string }>>;
  createProposal: typeof createAgentProposal;
};

const defaultDependencies: Dependencies = {
  findExisting: async ({ userId, payload }) => {
    const sourceUrl = payload.job.sourceUrl ?? null;
    const existing = await prisma.jobLead.findFirst({
      where: {
        ownerId: userId,
        OR: [
          {
            companyName: { equals: payload.job.companyName, mode: "insensitive" },
            roleTitle: { equals: payload.job.roleTitle, mode: "insensitive" }
          },
          ...(sourceUrl ? [{ sourceUrl }] : [])
        ]
      },
      select: {
        id: true,
        companyName: true,
        roleTitle: true,
        sourceUrl: true,
        application: { select: { id: true } }
      }
    });
    return existing ? {
      jobLeadId: existing.id,
      applicationId: existing.application?.id ?? null,
      proposalId: null,
      companyName: existing.companyName,
      roleTitle: existing.roleTitle,
      sourceUrl: existing.sourceUrl
    } : null;
  },
  findPending: ({ userId }) => prisma.agentProposal.findMany({
    where: {
      userId,
      type: AgentProposalType.JOB_APPLICATION_CREATE,
      status: { in: [AgentProposalStatus.PENDING, AgentProposalStatus.CONFIRMED] },
      applicationId: null
    },
    select: { id: true, payloadJson: true }
  }),
  createProposal: createAgentProposal
};

export async function proposeJobApplicationCreate({
  userId,
  input,
  dependencies = defaultDependencies
}: {
  userId: string;
  input: JobApplicationCreateProposalInput;
  dependencies?: Dependencies;
}) {
  const payload = jobApplicationCreateProposalPayloadSchema.parse(input);
  const existing = await dependencies.findExisting({ userId, payload });
  if (existing) throw new JobApplicationCreateProposalError("DUPLICATE_APPLICATION", existing);

  const pending = await dependencies.findPending({ userId });
  for (const candidate of pending) {
    const candidatePayload = safePayload(candidate.payloadJson);
    if (!candidatePayload || !sameObviousJob(payload, candidatePayload)) continue;
    throw new JobApplicationCreateProposalError("DUPLICATE_APPLICATION", {
      jobLeadId: null,
      applicationId: null,
      proposalId: candidate.id,
      companyName: candidatePayload.job.companyName,
      roleTitle: candidatePayload.job.roleTitle,
      sourceUrl: candidatePayload.job.sourceUrl ?? null
    });
  }

  const proposal = await dependencies.createProposal({
    userId,
    input: {
      type: AgentProposalType.JOB_APPLICATION_CREATE,
      payload,
      source: {
        type: "AGENT_JOB_APPLICATION_CREATE",
        identifier: payload.job.sourceUrl ?? null,
        evidenceText: `Agent proposed creating ${payload.job.companyName} | ${payload.job.roleTitle}.`
      }
    }
  });

  return {
    proposalId: proposal.id,
    status: proposal.status,
    companyName: payload.job.companyName,
    roleTitle: payload.job.roleTitle,
    city: payload.job.city ?? null,
    requestedStage: payload.application.requestedStage,
    confirmationRequired: true as const
  };
}

function safePayload(payloadJson: string) {
  try {
    return jobApplicationCreateProposalPayloadSchema.parse(JSON.parse(payloadJson));
  } catch {
    return null;
  }
}

function sameObviousJob(left: JobApplicationCreatePayload, right: JobApplicationCreatePayload) {
  const sameCompanyAndRole = normalize(left.job.companyName) === normalize(right.job.companyName)
    && normalize(left.job.roleTitle) === normalize(right.job.roleTitle);
  const leftUrl = left.job.sourceUrl?.trim() ?? "";
  const rightUrl = right.job.sourceUrl?.trim() ?? "";
  return sameCompanyAndRole || Boolean(leftUrl && rightUrl && leftUrl === rightUrl);
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase();
}
