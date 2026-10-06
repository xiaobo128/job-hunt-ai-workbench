import { ApplicationStage, AgentProposalStatus, AgentProposalType, EventType, Prisma, SourceType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { appendApplicationEvent, ApplicationNotFoundError, createJobApplication, updateApplicationStatus } from "./applications";
import { parseWallClockDateTime } from "../wall-clock";

const optionalText = z.string().trim().max(2_000).nullable().optional();
const optionalDate = z.string().refine((value) => parseWallClockDateTime(value) !== null, "Invalid wall-clock date-time").nullable().optional();
const optionalJobText = z.string().trim().max(2_000).transform((value) => value || undefined).optional();
const jobTextList = z.array(z.string().trim().min(1).max(2_000)).max(200).optional().default([]);
const httpUrl = z.string().trim().url().max(2_000).refine((value) => {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}, "sourceUrl must use http or https").optional();

export const applicationStatusProposalPayloadSchema = z.object({
  requestedStage: z.nativeEnum(ApplicationStage),
  note: optionalText,
  nextAction: optionalText,
  submissionChannel: optionalText
}).strict();

export const applicationEventProposalPayloadSchema = z.object({
  eventType: z.nativeEnum(EventType),
  title: z.string().trim().min(1).max(500),
  aiProvider: optionalText,
  aiNote: optionalText,
  eventTime: optionalDate,
  windowStartAt: optionalDate,
  deadlineAt: optionalDate,
  receivedAt: optionalDate,
  relativeValidityMinutes: z.number().int().positive().max(60 * 24 * 365).nullable().optional(),
  artifactName: optionalText,
  artifactUrl: z.string().url().max(2_000).nullable().optional(),
  detailsJson: z.string().min(1).max(50_000)
    .refine((value) => {
      try {
        const parsed: unknown = JSON.parse(value);
        return Boolean(parsed) && typeof parsed === "object" && !Array.isArray(parsed);
      } catch {
        return false;
      }
    }, "detailsJson must be a JSON object")
}).strict();

export const jobApplicationCreateProposalPayloadSchema = z.object({
  job: z.object({
    companyName: z.string().trim().min(1).max(500),
    roleTitle: z.string().trim().min(1).max(500),
    city: optionalJobText,
    industry: optionalJobText,
    seniority: optionalJobText,
    salaryRange: optionalJobText,
    sourceType: z.enum([SourceType.MANUAL, SourceType.TEXT, SourceType.LINK]).optional().default(SourceType.MANUAL),
    sourceName: optionalJobText,
    sourceUrl: httpUrl,
    skills: jobTextList,
    responsibilities: jobTextList,
    requirements: jobTextList,
    rawContent: z.string().trim().max(50_000).optional().default("")
  }).strict(),
  application: z.object({
    requestedStage: z.nativeEnum(ApplicationStage),
    submissionChannel: optionalJobText,
    nextAction: optionalJobText,
    note: optionalJobText
  }).strict()
}).strict();

const proposalSourceSchema = z.object({
  type: z.string().trim().min(1).max(80),
  identifier: z.string().trim().min(1).max(500).nullable().optional(),
  evidenceText: z.string().trim().min(1).max(20_000)
}).strict();

export const createAgentProposalInputSchema = z.discriminatedUnion("type", [
  z.object({ applicationId: z.string().trim().min(1), type: z.literal(AgentProposalType.APPLICATION_STATUS_UPDATE), payload: applicationStatusProposalPayloadSchema, source: proposalSourceSchema }).strict(),
  z.object({ applicationId: z.string().trim().min(1), type: z.literal(AgentProposalType.APPLICATION_EVENT_APPEND), payload: applicationEventProposalPayloadSchema, source: proposalSourceSchema }).strict(),
  z.object({ type: z.literal(AgentProposalType.JOB_APPLICATION_CREATE), payload: jobApplicationCreateProposalPayloadSchema, source: proposalSourceSchema }).strict()
]);

type StatusPayload = z.infer<typeof applicationStatusProposalPayloadSchema>;
type EventPayload = z.infer<typeof applicationEventProposalPayloadSchema>;
export type JobApplicationCreatePayload = z.infer<typeof jobApplicationCreateProposalPayloadSchema>;
type ProposalPayload = StatusPayload | EventPayload | JobApplicationCreatePayload;
type ApplicationDomainServices = {
  updateApplicationStatus: typeof updateApplicationStatus;
  appendApplicationEvent: typeof appendApplicationEvent;
  createJobApplication: typeof createJobApplication;
};

export class AgentProposalError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "NOT_CONFIRMED" | "REJECTED" | "ALREADY_EXECUTED" | "TYPE_MISMATCH" | "INVALID_PAYLOAD") {
    super(code);
    this.name = "AgentProposalError";
  }
}

export function ownedProposalWhere({ userId, proposalId }: { userId: string; proposalId: string }): Prisma.AgentProposalWhereInput {
  return {
    id: proposalId,
    ...ownedProposalAccessWhere(userId)
  };
}

export function ownedProposalAccessWhere(userId: string): Prisma.AgentProposalWhereInput {
  return {
    userId,
    OR: [
      { type: AgentProposalType.JOB_APPLICATION_CREATE, applicationId: null },
      {
        type: { in: [AgentProposalType.APPLICATION_STATUS_UPDATE, AgentProposalType.APPLICATION_EVENT_APPEND] },
        applicationId: { not: null },
        application: { jobLead: { ownerId: userId } }
      }
    ]
  };
}

function parsePayload(type: AgentProposalType, payload: unknown): ProposalPayload {
  if (type === AgentProposalType.APPLICATION_STATUS_UPDATE) return applicationStatusProposalPayloadSchema.parse(payload);
  if (type === AgentProposalType.APPLICATION_EVENT_APPEND) return applicationEventProposalPayloadSchema.parse(payload);
  return jobApplicationCreateProposalPayloadSchema.parse(payload);
}

function deserializePayload(type: AgentProposalType, payloadJson: string): ProposalPayload {
  try {
    return parsePayload(type, JSON.parse(payloadJson));
  } catch {
    throw new AgentProposalError("INVALID_PAYLOAD");
  }
}

/** Agents may prepare an exact proposal, but this function never confirms or executes it. */
export async function createAgentProposal({ userId, input }: { userId: string; input: unknown }) {
  const parsed = createAgentProposalInputSchema.parse(input);
  if (parsed.type === AgentProposalType.JOB_APPLICATION_CREATE) {
    return prisma.agentProposal.create({
      data: {
        userId,
        applicationId: null,
        type: parsed.type,
        payloadJson: JSON.stringify(parsed.payload),
        sourceType: parsed.source.type,
        sourceIdentifier: parsed.source.identifier ?? null,
        evidenceText: parsed.source.evidenceText
      }
    });
  }

  const application = await prisma.application.findFirst({
    where: { id: parsed.applicationId, jobLead: { ownerId: userId } },
    select: { id: true }
  });
  if (!application) throw new ApplicationNotFoundError();

  return prisma.agentProposal.create({
    data: {
      userId,
      applicationId: application.id,
      type: parsed.type,
      payloadJson: JSON.stringify(parsed.payload),
      sourceType: parsed.source.type,
      sourceIdentifier: parsed.source.identifier ?? null,
      evidenceText: parsed.source.evidenceText
    }
  });
}

/** This is deliberately available only to a session-authenticated web action. */
export async function confirmAgentProposal({ userId, proposalId }: { userId: string; proposalId: string }) {
  const confirmedAt = new Date();
  const confirmed = await prisma.agentProposal.updateMany({
    where: {
      ...ownedProposalWhere({ userId, proposalId }),
      status: AgentProposalStatus.PENDING,
    },
    data: { status: AgentProposalStatus.CONFIRMED, confirmedAt }
  });
  if (confirmed.count !== 1) throw new AgentProposalError("NOT_FOUND");
}

/** This is deliberately available only to a session-authenticated web action. */
export async function rejectAgentProposal({ userId, proposalId }: { userId: string; proposalId: string }) {
  const rejected = await prisma.agentProposal.updateMany({
    where: {
      ...ownedProposalWhere({ userId, proposalId }),
      status: AgentProposalStatus.PENDING,
    },
    data: { status: AgentProposalStatus.REJECTED, rejectedAt: new Date() }
  });
  if (rejected.count !== 1) throw new AgentProposalError("NOT_FOUND");
}

function toDate(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return parseWallClockDateTime(value);
}

type ExecutableProposal = {
  userId: string;
  applicationId: string | null;
  application: { jobLead: { ownerId: string } } | null;
  type: AgentProposalType;
  status: AgentProposalStatus;
};

/** Kept pure so the authorization and state-machine boundary is directly testable. */
export function assertProposalExecutable(input: { proposal: ExecutableProposal | null; userId: string; expectedType?: AgentProposalType }): asserts input is { proposal: ExecutableProposal; userId: string; expectedType?: AgentProposalType } {
  const { proposal, userId, expectedType } = input;
  if (!proposal || proposal.userId !== userId) throw new AgentProposalError("NOT_FOUND");
  if (proposal.type === AgentProposalType.JOB_APPLICATION_CREATE) {
    if (proposal.applicationId !== null || proposal.application !== null) throw new AgentProposalError("NOT_FOUND");
  } else if (!proposal.applicationId || !proposal.application || proposal.application.jobLead.ownerId !== userId) {
    throw new AgentProposalError("NOT_FOUND");
  }
  if (proposal.status === AgentProposalStatus.PENDING) throw new AgentProposalError("NOT_CONFIRMED");
  if (proposal.status === AgentProposalStatus.REJECTED) throw new AgentProposalError("REJECTED");
  if (proposal.status === AgentProposalStatus.EXECUTED) throw new AgentProposalError("ALREADY_EXECUTED");
  if (expectedType && proposal.type !== expectedType) throw new AgentProposalError("TYPE_MISMATCH");
}

/** Executes only the stored payload through the established application domain services. */
export async function executeProposalMutation({
  type,
  payloadJson,
  userId,
  applicationId,
  transaction,
  services = { updateApplicationStatus, appendApplicationEvent, createJobApplication }
}: {
  type: AgentProposalType;
  payloadJson: string;
  userId: string;
  applicationId: string | null;
  transaction: Prisma.TransactionClient;
  services?: ApplicationDomainServices;
}) {
  const payload = deserializePayload(type, payloadJson);
  if (type === AgentProposalType.JOB_APPLICATION_CREATE) {
    if (applicationId !== null) throw new AgentProposalError("INVALID_PAYLOAD");
    const createPayload = payload as JobApplicationCreatePayload;
    const created = await services.createJobApplication({
      userId,
      review: { needsReview: false },
      job: {
        ...createPayload.job,
        parseProvider: "external-agent",
        parseNote: "Reviewed and confirmed from an Agent proposal."
      },
      application: createPayload.application
    }, transaction);
    return { type, applicationId: created.application.id, jobLeadId: created.jobLeadId, eventId: null };
  }

  if (!applicationId) throw new AgentProposalError("INVALID_PAYLOAD");
  if (type === AgentProposalType.APPLICATION_STATUS_UPDATE) {
    const statusPayload = payload as StatusPayload;
    const application = await services.updateApplicationStatus({
      userId,
      applicationId,
      ...statusPayload,
      requestedStage: statusPayload.requestedStage as ApplicationStage
    }, transaction);
    return { type, applicationId: application.id, jobLeadId: null, eventId: null };
  }

  const eventPayload = payload as EventPayload;
  const event = await services.appendApplicationEvent({
    userId,
    applicationId,
    ...eventPayload,
    eventTime: toDate(eventPayload.eventTime),
    windowStartAt: toDate(eventPayload.windowStartAt),
    deadlineAt: toDate(eventPayload.deadlineAt),
    receivedAt: toDate(eventPayload.receivedAt)
  }, transaction);
  return { type, applicationId, jobLeadId: null, eventId: event.id };
}

/**
 * Claims the confirmed proposal in the same transaction as the canonical domain write.
 * A second caller cannot claim it after the first transaction commits, so replay is rejected.
 */
export async function executeConfirmedAgentProposal({ userId, proposalId, expectedType }: { userId: string; proposalId: string; expectedType?: AgentProposalType }) {
  return prisma.$transaction((tx) => executeConfirmedAgentProposalInTransaction({
    userId,
    proposalId,
    expectedType,
    transaction: tx
  }));
}

export async function executeConfirmedAgentProposalInTransaction({
  userId,
  proposalId,
  expectedType,
  transaction: tx,
  services
}: {
  userId: string;
  proposalId: string;
  expectedType?: AgentProposalType;
  transaction: Prisma.TransactionClient;
  services?: ApplicationDomainServices;
}) {
  const foundProposal = await tx.agentProposal.findFirst({
    where: { id: proposalId },
    select: { id: true, userId: true, applicationId: true, type: true, payloadJson: true, status: true, application: { select: { jobLead: { select: { ownerId: true } } } } }
  });
  const execution = { proposal: foundProposal, userId, expectedType };
  assertProposalExecutable(execution);
  const proposal = execution.proposal;

  const claimed = await tx.agentProposal.updateMany({
    where: { id: proposal.id, userId, status: AgentProposalStatus.CONFIRMED },
    data: { status: AgentProposalStatus.EXECUTED, executedAt: new Date() }
  });
  if (claimed.count !== 1) throw new AgentProposalError("ALREADY_EXECUTED");

  return executeProposalMutation({
    type: proposal.type,
    payloadJson: proposal.payloadJson,
    userId,
    applicationId: proposal.applicationId,
    transaction: tx,
    services
  });
}
