import { AgentProposalType, ApplicationStage, EventType } from "@prisma/client";
import type { RecruitmentEventExtraction, UserAiSettings } from "@/lib/ai";
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
      eventType: EventType;
      title: string;
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
}, dependencies: {
  createProposal: typeof createAgentProposal;
} = { createProposal: createAgentProposal }): Promise<RecruitmentEventProposalResult> {
  const eventType = toExistingEventType(input.extraction.eventType);
  if (!eventType) {
    return { created: false, reason: "UNKNOWN_EVENT_TYPE" };
  }

  const schedule = eventScheduleFields(input.extraction.schedule);
  const title = proposalTitle(input.subject, input.extraction);
  const proposal = await dependencies.createProposal({
    userId: input.userId,
    input: {
      applicationId: input.application.applicationId,
      type: AgentProposalType.APPLICATION_EVENT_APPEND,
      payload: {
        eventType,
        title,
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
    application: input.application,
    eventType,
    title
  };
}

export type ProposeRecruitmentEventInput = {
  applicationId: string;
  subject?: string;
  sender?: string;
  receivedAt?: string;
  content: string;
};

type OwnedRecruitmentEventApplication = RecruitmentEventApplication & {
  currentStage: ApplicationStage;
  jobLeadStage: ApplicationStage;
  aiSettings: UserAiSettings;
};

type ProposeRecruitmentEventDependencies = {
  findOwnedApplication: (input: { userId: string; applicationId: string }) => Promise<OwnedRecruitmentEventApplication | null>;
  extractEvent: (input: {
    subject: string;
    sender: string;
    receivedAt: string | null;
    content: string;
    settings: UserAiSettings;
  }) => Promise<{ data: RecruitmentEventExtraction }>;
  createProposal: typeof createRecruitmentEventProposal;
};

export class RecruitmentEventProposalError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "APPLICATION_CLOSED" | "CONTENT_REQUIRED" | "UNKNOWN_EVENT_TYPE") {
    super(code);
    this.name = "RecruitmentEventProposalError";
  }
}

/** Coordinates extraction and proposal creation for one explicitly selected application. */
export async function proposeRecruitmentEvent({
  userId,
  input,
  dependencies
}: {
  userId: string;
  input: ProposeRecruitmentEventInput;
  dependencies: ProposeRecruitmentEventDependencies;
}) {
  if (!input.content.trim()) throw new RecruitmentEventProposalError("CONTENT_REQUIRED");

  const application = await dependencies.findOwnedApplication({ userId, applicationId: input.applicationId });
  if (!application) throw new RecruitmentEventProposalError("NOT_FOUND");
  if (
    application.currentStage === ApplicationStage.CLOSED ||
    application.currentStage === ApplicationStage.REJECTED ||
    application.jobLeadStage === ApplicationStage.CLOSED ||
    application.jobLeadStage === ApplicationStage.REJECTED
  ) {
    throw new RecruitmentEventProposalError("APPLICATION_CLOSED");
  }

  const subject = input.subject?.trim() ?? "";
  const sender = input.sender?.trim() ?? "";
  const receivedAt = input.receivedAt?.trim() || null;
  const extracted = await dependencies.extractEvent({
    subject,
    sender,
    receivedAt,
    content: input.content,
    settings: application.aiSettings
  });
  const proposal = await dependencies.createProposal({
    userId,
    extraction: extracted.data,
    application: {
      applicationId: application.applicationId,
      companyName: application.companyName,
      roleTitle: application.roleTitle
    },
    subject,
    receivedAt,
    content: input.content
  });
  if (!proposal.created) throw new RecruitmentEventProposalError("UNKNOWN_EVENT_TYPE");

  return {
    proposalId: proposal.proposalId,
    status: proposal.status,
    applicationId: application.applicationId,
    companyName: application.companyName,
    roleTitle: application.roleTitle,
    eventType: proposal.eventType,
    title: proposal.title,
    schedule: extracted.data.schedule,
    intent: extracted.data.intent,
    deliveryMode: extracted.data.deliveryMode,
    onlineUrl: extracted.data.onlineUrl,
    offlineAddress: extracted.data.offlineAddress,
    actions: extracted.data.actions,
    requirements: extracted.data.requirements,
    confirmationRequired: true as const
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
