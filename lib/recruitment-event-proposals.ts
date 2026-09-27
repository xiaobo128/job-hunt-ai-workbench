import { AgentProposalType, EventType } from "@prisma/client";
import { z } from "zod";
import type { RecruitmentEventExtraction } from "@/lib/ai";
import { createAgentProposal } from "@/lib/domain/agent-proposals";
import {
  recruitmentEventSelectionCandidates,
  type RecruitmentApplicationMatch
} from "@/lib/recruitment-event-matching";

const isoDateTimeWithOffset = z.string().datetime({ offset: true });

export type RecruitmentEventProposalResult =
  | {
      created: true;
      proposalId: string;
      status: string;
      match: RecruitmentApplicationMatch;
      candidates: readonly RecruitmentApplicationMatch[];
    }
  | {
      created: false;
      reason: "UNKNOWN_EVENT_TYPE" | "NO_HIGH_CONFIDENCE_MATCH" | "AMBIGUOUS_HIGH_CONFIDENCE_MATCH" | "INVALID_SELECTED_APPLICATION";
      candidates: readonly RecruitmentApplicationMatch[];
    };

/**
 * Prepares the existing HITL proposal for either a unique HIGH match or an explicit
 * user selection from the bounded HIGH/MEDIUM fallback candidates.
 * Persistence, ownership checks, and proposal validation remain inside createAgentProposal.
 */
export async function createRecruitmentEventProposalIfHighConfidence(input: {
  userId: string;
  extraction: RecruitmentEventExtraction;
  candidates: readonly RecruitmentApplicationMatch[];
  subject: string;
  receivedAt: string | null;
  content: string;
  identifier?: string | null;
  selectedApplicationId?: string | null;
}): Promise<RecruitmentEventProposalResult> {
  const selectionCandidates = recruitmentEventSelectionCandidates(input.candidates);
  const eventType = toExistingEventType(input.extraction.eventType);
  if (!eventType) {
    return { created: false, reason: "UNKNOWN_EVENT_TYPE", candidates: selectionCandidates };
  }

  const highConfidenceMatches = input.candidates.filter((candidate) => candidate.confidence === "HIGH");
  let match: RecruitmentApplicationMatch;

  if (input.selectedApplicationId) {
    const selectedMatch = selectionCandidates.find(
      (candidate) => candidate.applicationId === input.selectedApplicationId
    );
    if (!selectedMatch) {
      return { created: false, reason: "INVALID_SELECTED_APPLICATION", candidates: selectionCandidates };
    }
    match = selectedMatch;
  } else {
    if (highConfidenceMatches.length === 0) {
      return { created: false, reason: "NO_HIGH_CONFIDENCE_MATCH", candidates: selectionCandidates };
    }
    if (highConfidenceMatches.length > 1) {
      return { created: false, reason: "AMBIGUOUS_HIGH_CONFIDENCE_MATCH", candidates: selectionCandidates };
    }
    match = highConfidenceMatches[0];
  }

  const schedule = eventScheduleFields(input.extraction.schedule);
  const proposal = await createAgentProposal({
    userId: input.userId,
    input: {
      applicationId: match.applicationId,
      type: AgentProposalType.APPLICATION_EVENT_APPEND,
      payload: {
        eventType,
        title: proposalTitle(input.subject, input.extraction),
        eventTime: schedule.eventTime,
        windowStartAt: schedule.windowStartAt,
        deadlineAt: schedule.deadlineAt,
        receivedAt: confirmedIsoDateTime(input.receivedAt),
        detailsJson: JSON.stringify({
          content: input.content,
          summary: input.extraction.summary,
          requirements: input.extraction.requirements,
          extraction: {
            companyHint: input.extraction.companyHint,
            roleHint: input.extraction.roleHint,
            intent: input.extraction.intent,
            schedule: input.extraction.schedule,
            deliveryMode: input.extraction.deliveryMode,
            onlineUrl: input.extraction.onlineUrl,
            offlineAddress: input.extraction.offlineAddress,
            actions: input.extraction.actions
          }
        })
      },
      source: {
        type: "RECRUITMENT_EMAIL",
        identifier: normalizedIdentifier(input.identifier),
        evidenceText: input.extraction.evidenceText
      }
    }
  });

  return {
    created: true,
    proposalId: proposal.id,
    status: proposal.status,
    match,
    candidates: selectionCandidates
  };
}

function toExistingEventType(value: RecruitmentEventExtraction["eventType"]): EventType | null {
  return Object.values(EventType).includes(value as EventType) ? value as EventType : null;
}

function proposalTitle(subject: string, extraction: RecruitmentEventExtraction) {
  const title = subject.trim() || extraction.summary || `招聘通知：${extraction.eventType}`;
  return title.slice(0, 500);
}

function confirmedIsoDateTime(value: string | null) {
  if (!value || !isoDateTimeWithOffset.safeParse(value).success) return null;
  return value;
}

function eventScheduleFields(schedule: RecruitmentEventExtraction["schedule"]) {
  if (schedule.type === "FIXED_TIME") {
    return { eventTime: schedule.startAt, windowStartAt: null, deadlineAt: null };
  }
  if (schedule.type === "TIME_WINDOW") {
    return { eventTime: null, windowStartAt: schedule.startAt, deadlineAt: schedule.endAt };
  }
  if (schedule.type === "DEADLINE") {
    return { eventTime: null, windowStartAt: null, deadlineAt: schedule.endAt };
  }
  return { eventTime: null, windowStartAt: null, deadlineAt: null };
}

function normalizedIdentifier(value: string | null | undefined) {
  return value?.trim() || null;
}
