import { AgentProposalType, EventType } from "@prisma/client";
import type { RecruitmentEventExtraction } from "@/lib/ai";
import { createAgentProposal } from "@/lib/domain/agent-proposals";

export type RecruitmentEventApplication = {
  applicationId: string;
  companyName: string;
  roleTitle: string;
};

export type RecruitmentEventProposalResult =
  | {
      created: true;
      proposalId: string;
      status: string;
      application: RecruitmentEventApplication;
    }
  | {
      created: false;
      reason: "UNKNOWN_EVENT_TYPE";
    };

/**
 * Prepares the existing HITL proposal for the application explicitly selected by the user.
 * Persistence, ownership checks, and proposal validation remain inside createAgentProposal.
 */
export async function createRecruitmentEventProposal(input: {
  userId: string;
  extraction: RecruitmentEventExtraction;
  application: RecruitmentEventApplication;
  subject: string;
  receivedAt: string | null;
  content: string;
  identifier?: string | null;
}): Promise<RecruitmentEventProposalResult> {
  const eventType = toExistingEventType(input.extraction.eventType);
  if (!eventType) {
    return { created: false, reason: "UNKNOWN_EVENT_TYPE" };
  }

  const schedule = eventScheduleFields(input.extraction.schedule);
  const proposal = await createAgentProposal({
    userId: input.userId,
    input: {
      applicationId: input.application.applicationId,
      type: AgentProposalType.APPLICATION_EVENT_APPEND,
      payload: {
        eventType,
        title: proposalTitle(input.subject, input.extraction),
        eventTime: schedule.eventTime,
        windowStartAt: schedule.windowStartAt,
        deadlineAt: schedule.deadlineAt,
        receivedAt: null,
        detailsJson: JSON.stringify({
          content: input.content,
          receivedAtRaw: input.receivedAt,
          requirements: input.extraction.requirements ?? [],
          actions: input.extraction.actions ?? [],
          extraction: {
            companyHint: input.extraction.companyHint,
            roleHint: input.extraction.roleHint,
            intent: input.extraction.intent,
            schedule: input.extraction.schedule,
            deliveryMode: input.extraction.deliveryMode,
            deliveryModeRawText: input.extraction.deliveryModeRawText,
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
    application: input.application
  };
}

function toExistingEventType(value: RecruitmentEventExtraction["eventType"]): EventType | null {
  return Object.values(EventType).includes(value as EventType) ? value as EventType : null;
}

function proposalTitle(subject: string, extraction: RecruitmentEventExtraction) {
  const title = subject.trim() || `招聘通知：${extraction.eventType}`;
  return title.slice(0, 500);
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
