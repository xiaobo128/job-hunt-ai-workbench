import { AgentProposalType, EventStatus, EventType } from "@prisma/client";
import { z } from "zod";
import { formatWallClockDateTime, parseWallClockDateTime } from "../wall-clock";
import { resolveEventTime, type EventTimeInput } from "../event-time";
import {
  ApplicationEventUpdateError,
  validateApplicationEventTime
} from "./applications";
import {
  applicationEventUpdatePatchSchema,
  createAgentProposal,
  type ApplicationEventUpdatePayload
} from "./agent-proposals";

const inputSchema = z.object({
  applicationId: z.string().trim().min(1),
  eventId: z.string().trim().min(1),
  patch: applicationEventUpdatePatchSchema.optional(),
  deriveDeadlineFromRelativeValidity: z.boolean().optional()
}).strict().refine(
  (input) => input.patch !== undefined || input.deriveDeadlineFromRelativeValidity === true,
  "An event patch or deadline derivation is required"
);

export type ProposeRecruitmentEventUpdateInput = z.input<typeof inputSchema>;
type EventUpdatePatch = ApplicationEventUpdatePayload["patch"];

export type OwnedApplicationEventForUpdate = {
  id: string;
  applicationId: string;
  eventType: EventType;
  status: EventStatus;
  title: string;
  eventTime: Date | null;
  windowStartAt: Date | null;
  deadlineAt: Date | null;
  receivedAt: Date | null;
  relativeValidityMinutes: number | null;
  detailsJson: string;
  application: {
    jobLead: { companyName: string; roleTitle: string };
  };
};

type Dependencies = {
  findOwnedEvent: (input: { userId: string; eventId: string }) => Promise<OwnedApplicationEventForUpdate | null>;
  createProposal: typeof createAgentProposal;
};

export class RecruitmentEventUpdateProposalError extends Error {
  constructor(public readonly code:
    | "NOT_FOUND"
    | "APPLICATION_MISMATCH"
    | "AMBIGUOUS_DEADLINE_SOURCE"
    | "MISSING_RECEIVED_AT"
    | "INVALID_RELATIVE_VALIDITY"
    | "INVALID_TIME_RANGE"
    | "EFFECTIVE_DUE_CHANGED"
    | "NO_CHANGES") {
    super(code);
    this.name = "RecruitmentEventUpdateProposalError";
  }
}

/** Builds one exact, reviewable update payload without mutating the Event. */
export async function proposeRecruitmentEventUpdate({
  userId,
  input,
  dependencies
}: {
  userId: string;
  input: ProposeRecruitmentEventUpdateInput;
  dependencies: Dependencies;
}) {
  const parsed = inputSchema.parse(input);
  if (parsed.deriveDeadlineFromRelativeValidity && parsed.patch?.deadlineAt !== undefined) {
    throw new RecruitmentEventUpdateProposalError("AMBIGUOUS_DEADLINE_SOURCE");
  }

  const event = await dependencies.findOwnedEvent({ userId, eventId: parsed.eventId });
  if (!event) throw new RecruitmentEventUpdateProposalError("NOT_FOUND");
  if (event.applicationId !== parsed.applicationId) {
    throw new RecruitmentEventUpdateProposalError("APPLICATION_MISMATCH");
  }

  const patch = normalizePatch(parsed.patch ?? {});
  const beforeTime = eventTime(event);
  let finalTime = applyTimePatch(beforeTime, patch);

  try {
    validateApplicationEventTime(finalTime);
  } catch (cause) {
    throw mapTimeValidationError(cause);
  }

  if (parsed.deriveDeadlineFromRelativeValidity) {
    if (finalTime.receivedAt === null) {
      throw new RecruitmentEventUpdateProposalError("MISSING_RECEIVED_AT");
    }
    if (
      finalTime.relativeValidityMinutes === null ||
      !Number.isInteger(finalTime.relativeValidityMinutes) ||
      finalTime.relativeValidityMinutes <= 0 ||
      finalTime.relativeValidityMinutes > 60 * 24 * 365
    ) {
      throw new RecruitmentEventUpdateProposalError("INVALID_RELATIVE_VALIDITY");
    }

    const validUntil = resolveEventTime(finalTime).validUntil;
    if (!validUntil) throw new RecruitmentEventUpdateProposalError("INVALID_RELATIVE_VALIDITY");
    patch.deadlineAt = formatWallClockDateTime(validUntil);
    finalTime = { ...finalTime, deadlineAt: validUntil };

    if (parsed.patch?.receivedAt === undefined && parsed.patch?.relativeValidityMinutes === undefined) {
      const beforeDueAt = resolveEventTime(beforeTime).effectiveDueAt;
      const afterDueAt = resolveEventTime(finalTime).effectiveDueAt;
      if (!sameDate(beforeDueAt, afterDueAt)) {
        throw new RecruitmentEventUpdateProposalError("EFFECTIVE_DUE_CHANGED");
      }
    }
  }

  try {
    validateApplicationEventTime(finalTime);
  } catch (cause) {
    throw mapTimeValidationError(cause);
  }

  if (!eventPatchChangesEvent(event, patch)) {
    throw new RecruitmentEventUpdateProposalError("NO_CHANGES");
  }

  const proposal = await dependencies.createProposal({
    userId,
    input: {
      applicationId: event.applicationId,
      type: AgentProposalType.APPLICATION_EVENT_UPDATE,
      payload: { eventId: event.id, patch },
      source: {
        type: "AGENT_EVENT_UPDATE",
        identifier: event.id,
        evidenceText: `Agent proposed updating recruitment event ${event.id}.`
      }
    }
  });

  return {
    proposalId: proposal.id,
    status: proposal.status,
    applicationId: event.applicationId,
    eventId: event.id,
    companyName: event.application.jobLead.companyName,
    roleTitle: event.application.jobLead.roleTitle,
    title: patch.title ?? event.title,
    current: eventForReview(event),
    patch,
    confirmationRequired: true as const
  };
}

function normalizePatch(patch: EventUpdatePatch): EventUpdatePatch {
  return {
    ...patch,
    ...(patch.eventTime !== undefined ? { eventTime: normalizeDate(patch.eventTime) } : {}),
    ...(patch.windowStartAt !== undefined ? { windowStartAt: normalizeDate(patch.windowStartAt) } : {}),
    ...(patch.deadlineAt !== undefined ? { deadlineAt: normalizeDate(patch.deadlineAt) } : {}),
    ...(patch.receivedAt !== undefined ? { receivedAt: normalizeDate(patch.receivedAt) } : {})
  };
}

function normalizeDate(value: string | null) {
  if (value === null) return null;
  return formatWallClockDateTime(parseWallClockDateTime(value));
}

function eventTime(event: OwnedApplicationEventForUpdate): EventTimeInput {
  return {
    eventTime: event.eventTime,
    windowStartAt: event.windowStartAt,
    deadlineAt: event.deadlineAt,
    receivedAt: event.receivedAt,
    relativeValidityMinutes: event.relativeValidityMinutes
  };
}

function applyTimePatch(current: EventTimeInput, patch: EventUpdatePatch): EventTimeInput {
  return {
    eventTime: patch.eventTime === undefined ? current.eventTime : toDate(patch.eventTime),
    windowStartAt: patch.windowStartAt === undefined ? current.windowStartAt : toDate(patch.windowStartAt),
    deadlineAt: patch.deadlineAt === undefined ? current.deadlineAt : toDate(patch.deadlineAt),
    receivedAt: patch.receivedAt === undefined ? current.receivedAt : toDate(patch.receivedAt),
    relativeValidityMinutes: patch.relativeValidityMinutes === undefined
      ? current.relativeValidityMinutes
      : patch.relativeValidityMinutes
  };
}

function toDate(value: string | null) {
  return value === null ? null : parseWallClockDateTime(value);
}

function eventPatchChangesEvent(event: OwnedApplicationEventForUpdate, patch: EventUpdatePatch) {
  const details = parseDetails(event.detailsJson);
  return Object.entries(patch).some(([field, value]) => {
    if (field === "content") return value !== details.content;
    if (field === "requirements") return !sameStringList(value as string[], details.requirements);
    if (field === "eventTime" || field === "windowStartAt" || field === "deadlineAt" || field === "receivedAt") {
      return !sameDate(event[field], toDate(value as string | null));
    }
    return value !== event[field as keyof OwnedApplicationEventForUpdate];
  });
}

function eventForReview(event: OwnedApplicationEventForUpdate) {
  const details = parseDetails(event.detailsJson);
  return {
    eventType: event.eventType,
    status: event.status,
    title: event.title,
    eventTime: formatWallClockDateTime(event.eventTime),
    windowStartAt: formatWallClockDateTime(event.windowStartAt),
    deadlineAt: formatWallClockDateTime(event.deadlineAt),
    receivedAt: formatWallClockDateTime(event.receivedAt),
    relativeValidityMinutes: event.relativeValidityMinutes,
    content: details.content,
    requirements: details.requirements
  };
}

function parseDetails(detailsJson: string) {
  try {
    const parsed = JSON.parse(detailsJson) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { content: "", requirements: [] as string[] };
    return {
      content: typeof parsed.content === "string" ? parsed.content : "",
      requirements: Array.isArray(parsed.requirements)
        ? parsed.requirements.filter((value): value is string => typeof value === "string")
        : []
    };
  } catch {
    return { content: "", requirements: [] as string[] };
  }
}

function sameStringList(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameDate(left: Date | null, right: Date | null) {
  return left === null ? right === null : right !== null && left.getTime() === right.getTime();
}

function mapTimeValidationError(cause: unknown) {
  if (cause instanceof ApplicationEventUpdateError) {
    if (cause.code === "INVALID_TIME_RANGE") return new RecruitmentEventUpdateProposalError("INVALID_TIME_RANGE");
    if (cause.code === "INVALID_RELATIVE_VALIDITY") return new RecruitmentEventUpdateProposalError("INVALID_RELATIVE_VALIDITY");
    if (cause.code === "RECEIVED_AT_REQUIRED") return new RecruitmentEventUpdateProposalError("MISSING_RECEIVED_AT");
  }
  return cause;
}
