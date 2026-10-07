import { AgentProposalType, type EventStatus, type EventType } from "@prisma/client";
import { prisma } from "./db";

export type ProposalEventReview = {
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
};

type ProposalReference = {
  id: string;
  type: AgentProposalType;
  applicationId: string | null;
  payloadJson: string;
};

/** Loads all update targets in one owned query for proposal review pages. */
export async function getOwnedProposalEventReviews(userId: string, proposals: ProposalReference[]) {
  const targets = proposals.flatMap((proposal) => {
    if (proposal.type !== AgentProposalType.APPLICATION_EVENT_UPDATE || !proposal.applicationId) return [];
    const eventId = readEventId(proposal.payloadJson);
    return eventId ? [{ proposalId: proposal.id, applicationId: proposal.applicationId, eventId }] : [];
  });
  if (targets.length === 0) return new Map<string, ProposalEventReview>();

  const events = await prisma.event.findMany({
    where: {
      id: { in: [...new Set(targets.map((target) => target.eventId))] },
      application: { jobLead: { ownerId: userId } }
    },
    select: {
      id: true,
      applicationId: true,
      eventType: true,
      status: true,
      title: true,
      eventTime: true,
      windowStartAt: true,
      deadlineAt: true,
      receivedAt: true,
      relativeValidityMinutes: true,
      detailsJson: true
    }
  });
  const eventsById = new Map(events.map((event) => [event.id, event]));
  const reviews = new Map<string, ProposalEventReview>();
  for (const target of targets) {
    const event = eventsById.get(target.eventId);
    if (event?.applicationId === target.applicationId) reviews.set(target.proposalId, event);
  }
  return reviews;
}

function readEventId(payloadJson: string) {
  try {
    const payload: unknown = JSON.parse(payloadJson);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    const eventId = (payload as Record<string, unknown>).eventId;
    return typeof eventId === "string" && eventId.trim() ? eventId : null;
  } catch {
    return null;
  }
}
