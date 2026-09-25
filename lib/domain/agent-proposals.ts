import { ApplicationStage, AgentProposalStatus, AgentProposalType, EventType, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { appendApplicationEvent, ApplicationNotFoundError, updateApplicationStatus } from "./applications";

const optionalText = z.string().trim().max(2_000).nullable().optional();
const optionalDate = z.string().datetime({ offset: true }).nullable().optional();

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

export const createAgentProposalInputSchema = z.object({
  applicationId: z.string().trim().min(1),
  type: z.nativeEnum(AgentProposalType),
  payload: z.unknown(),
  source: z.object({
    type: z.string().trim().min(1).max(80),
    identifier: z.string().trim().min(1).max(500).nullable().optional(),
    evidenceText: z.string().trim().min(1).max(20_000)
  }).strict()
}).strict();

type StatusPayload = z.infer<typeof applicationStatusProposalPayloadSchema>;
type EventPayload = z.infer<typeof applicationEventProposalPayloadSchema>;
type ProposalPayload = StatusPayload | EventPayload;
type ApplicationDomainServices = {
  updateApplicationStatus: typeof updateApplicationStatus;
  appendApplicationEvent: typeof appendApplicationEvent;
};

export class AgentProposalError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "NOT_CONFIRMED" | "REJECTED" | "ALREADY_EXECUTED" | "TYPE_MISMATCH" | "INVALID_PAYLOAD") {
    super(code);
    this.name = "AgentProposalError";
  }
}

function parsePayload(type: AgentProposalType, payload: unknown): ProposalPayload {
  return type === AgentProposalType.APPLICATION_STATUS_UPDATE
    ? applicationStatusProposalPayloadSchema.parse(payload)
    : applicationEventProposalPayloadSchema.parse(payload);
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
  const application = await prisma.application.findFirst({
    where: { id: parsed.applicationId, jobLead: { ownerId: userId } },
    select: { id: true }
  });
  if (!application) throw new ApplicationNotFoundError();

  const payload = parsePayload(parsed.type, parsed.payload);
  return prisma.agentProposal.create({
    data: {
      userId,
      applicationId: application.id,
      type: parsed.type,
      payloadJson: JSON.stringify(payload),
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
      id: proposalId,
      userId,
      status: AgentProposalStatus.PENDING,
      application: { jobLead: { ownerId: userId } }
    },
    data: { status: AgentProposalStatus.CONFIRMED, confirmedAt }
  });
  if (confirmed.count !== 1) throw new AgentProposalError("NOT_FOUND");
}

/** This is deliberately available only to a session-authenticated web action. */
export async function rejectAgentProposal({ userId, proposalId }: { userId: string; proposalId: string }) {
  const rejected = await prisma.agentProposal.updateMany({
    where: {
      id: proposalId,
      userId,
      status: AgentProposalStatus.PENDING,
      application: { jobLead: { ownerId: userId } }
    },
    data: { status: AgentProposalStatus.REJECTED, rejectedAt: new Date() }
  });
  if (rejected.count !== 1) throw new AgentProposalError("NOT_FOUND");
}

function toDate(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(value);
}

type ExecutableProposal = {
  userId: string;
  application: { jobLead: { ownerId: string } };
  type: AgentProposalType;
  status: AgentProposalStatus;
};

/** Kept pure so the authorization and state-machine boundary is directly testable. */
export function assertProposalExecutable(input: { proposal: ExecutableProposal | null; userId: string; expectedType?: AgentProposalType }): asserts input is { proposal: ExecutableProposal; userId: string; expectedType?: AgentProposalType } {
  const { proposal, userId, expectedType } = input;
  if (!proposal || proposal.userId !== userId || proposal.application.jobLead.ownerId !== userId) throw new AgentProposalError("NOT_FOUND");
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
  services = { updateApplicationStatus, appendApplicationEvent }
}: {
  type: AgentProposalType;
  payloadJson: string;
  userId: string;
  applicationId: string;
  transaction: Prisma.TransactionClient;
  services?: ApplicationDomainServices;
}) {
  const payload = deserializePayload(type, payloadJson);
  if (type === AgentProposalType.APPLICATION_STATUS_UPDATE) {
    const statusPayload = payload as StatusPayload;
    const application = await services.updateApplicationStatus({
      userId,
      applicationId,
      ...statusPayload,
      requestedStage: statusPayload.requestedStage as ApplicationStage
    }, transaction);
    return { type, applicationId: application.id, eventId: null };
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
  return { type, applicationId, eventId: event.id };
}

/**
 * Claims the confirmed proposal in the same transaction as the canonical domain write.
 * A second caller cannot claim it after the first transaction commits, so replay is rejected.
 */
export async function executeConfirmedAgentProposal({ userId, proposalId, expectedType }: { userId: string; proposalId: string; expectedType?: AgentProposalType }) {
  return prisma.$transaction(async (tx) => {
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

    return executeProposalMutation({ type: proposal.type, payloadJson: proposal.payloadJson, userId, applicationId: proposal.applicationId, transaction: tx });
  });
}
