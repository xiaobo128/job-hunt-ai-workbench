import { AgentProposalType, EventType } from "@prisma/client";
import { z } from "zod";
import type { RecruitmentEventExtraction } from "@/lib/ai";
import { createAgentProposal } from "@/lib/domain/agent-proposals";
import type { RecruitmentApplicationMatch } from "@/lib/recruitment-event-matching";

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
      reason: "UNKNOWN_EVENT_TYPE" | "NO_HIGH_CONFIDENCE_MATCH" | "AMBIGUOUS_HIGH_CONFIDENCE_MATCH";
      candidates: readonly RecruitmentApplicationMatch[];
    };

/**
 * Prepares the existing HITL proposal only when matching is unambiguous and high-confidence.
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
}): Promise<RecruitmentEventProposalResult> {
  const eventType = toExistingEventType(input.extraction.eventType);
  if (!eventType) {
    return { created: false, reason: "UNKNOWN_EVENT_TYPE", candidates: input.candidates };
  }

  const highConfidenceMatches = input.candidates.filter((candidate) => candidate.confidence === "HIGH");
  if (highConfidenceMatches.length === 0) {
    return { created: false, reason: "NO_HIGH_CONFIDENCE_MATCH", candidates: input.candidates };
  }
  if (highConfidenceMatches.length > 1) {
    return { created: false, reason: "AMBIGUOUS_HIGH_CONFIDENCE_MATCH", candidates: input.candidates };
  }

  const match = highConfidenceMatches[0];
  const proposal = await createAgentProposal({
    userId: input.userId,
    input: {
      applicationId: match.applicationId,
      type: AgentProposalType.APPLICATION_EVENT_APPEND,
      payload: {
        eventType,
        title: proposalTitle(input.subject, input.extraction),
        eventTime: input.extraction.eventTime,
        receivedAt: confirmedIsoDateTime(input.receivedAt),
        detailsJson: JSON.stringify({
          content: input.content,
          summary: input.extraction.summary,
          requirements: input.extraction.requirements,
          extraction: {
            companyHint: input.extraction.companyHint,
            roleHint: input.extraction.roleHint,
            intent: input.extraction.intent,
            deadline: input.extraction.deadline,
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
    candidates: input.candidates
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

function normalizedIdentifier(value: string | null | undefined) {
  return value?.trim() || null;
}
