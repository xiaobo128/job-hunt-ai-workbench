import { ApplicationStage, EventStatus, EventType, Prisma, SourceType } from "@prisma/client";
import { prisma } from "../db";
import type { EventTimeInput } from "../event-time";

export class ApplicationNotFoundError extends Error {
  constructor() {
    super("Application not found");
    this.name = "ApplicationNotFoundError";
  }
}

export class ApplicationEventUpdateError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "APPLICATION_MISMATCH" | "TARGET_APPLICATION_NOT_FOUND" | "INVALID_TIME_RANGE" | "INVALID_RELATIVE_VALIDITY" | "RECEIVED_AT_REQUIRED") {
    super(code);
    this.name = "ApplicationEventUpdateError";
  }
}

export type CreateJobApplicationInput = {
  userId: string;
  review: {
    needsReview: boolean;
    reviewedAt?: Date | null;
  };
  job: {
    companyName: string;
    roleTitle: string;
    city?: string | null;
    industry?: string | null;
    seniority?: string | null;
    salaryRange?: string | null;
    sourceType: SourceType;
    sourceName?: string | null;
    sourceUrl?: string | null;
    skills: string[];
    responsibilities: string[];
    requirements: string[];
    rawContent: string;
    parseProvider?: string | null;
    parseNote?: string | null;
    artifactName?: string | null;
    artifactUrl?: string | null;
    artifactNamesJson?: string | null;
    artifactUrlsJson?: string | null;
    parsedSummary?: string | null;
  };
  application: {
    requestedStage: ApplicationStage;
    submissionChannel?: string | null;
    nextAction?: string | null;
    note?: string | null;
  };
};

/** Creates one reviewed canonical job/application pair and applies the existing stage rules. */
export async function createJobApplication(input: CreateJobApplicationInput, transaction?: Prisma.TransactionClient) {
  const run = async (tx: Prisma.TransactionClient) => {
    const reviewedAt = input.review.needsReview ? input.review.reviewedAt ?? null : input.review.reviewedAt ?? new Date();
    const created = await tx.jobLead.create({
      data: {
        ownerId: input.userId,
        parseProvider: input.job.parseProvider ?? null,
        parseNote: input.job.parseNote ?? null,
        needsReview: input.review.needsReview,
        reviewedAt,
        sourceType: input.job.sourceType,
        sourceName: input.job.sourceName ?? null,
        sourceUrl: input.job.sourceUrl ?? null,
        artifactName: input.job.artifactName ?? null,
        artifactUrl: input.job.artifactUrl ?? null,
        artifactNamesJson: input.job.artifactNamesJson ?? null,
        artifactUrlsJson: input.job.artifactUrlsJson ?? null,
        companyName: input.job.companyName,
        roleTitle: input.job.roleTitle,
        city: input.job.city ?? null,
        industry: input.job.industry ?? null,
        seniority: input.job.seniority ?? null,
        salaryRange: input.job.salaryRange ?? null,
        skills: JSON.stringify(input.job.skills),
        responsibilities: JSON.stringify(input.job.responsibilities),
        requirements: JSON.stringify(input.job.requirements),
        rawContent: input.job.rawContent,
        parsedSummary: input.job.parsedSummary ?? null,
        status: ApplicationStage.READY_TO_APPLY,
        application: { create: { currentStage: ApplicationStage.READY_TO_APPLY } }
      },
      select: { id: true, application: { select: { id: true } } }
    });

    if (!created.application) throw new Error("Application creation failed");
    const application = await updateApplicationStatus({
      userId: input.userId,
      applicationId: created.application.id,
      requestedStage: input.application.requestedStage,
      submissionChannel: input.application.submissionChannel,
      nextAction: input.application.nextAction,
      note: input.application.note
    }, tx);

    return { jobLeadId: created.id, application };
  };

  return transaction ? run(transaction) : prisma.$transaction(run);
}

type UpdateApplicationStatusInput = {
  userId: string;
  applicationId: string;
  requestedStage: ApplicationStage;
  note?: string | null;
  nextAction?: string | null;
  submissionChannel?: string | null;
};

/** Updates the canonical application and job-lead stage together. */
export async function updateApplicationStatus({
  userId,
  applicationId,
  requestedStage,
  note,
  nextAction,
  submissionChannel
}: UpdateApplicationStatusInput, transaction?: Prisma.TransactionClient) {
  const run = async (tx: Prisma.TransactionClient) => {
    const application = await tx.application.findFirst({
      where: { id: applicationId, jobLead: { ownerId: userId } },
      select: { id: true, jobLeadId: true, currentStage: true }
    });

    if (!application) {
      throw new ApplicationNotFoundError();
    }

    const updatedApplication = await tx.application.update({
      where: { id: application.id },
      data: {
        currentStage: requestedStage,
        ...(note !== undefined ? { note } : {}),
        ...(nextAction !== undefined ? { nextAction } : {}),
        ...(submissionChannel !== undefined ? { submissionChannel } : {}),
        appliedAt:
          requestedStage === ApplicationStage.APPLIED && application.currentStage !== ApplicationStage.APPLIED
            ? new Date()
            : undefined
      }
    });

    await tx.jobLead.update({
      where: { id: application.jobLeadId },
      data: { status: requestedStage }
    });

    return updatedApplication;
  };

  return transaction ? run(transaction) : prisma.$transaction(run);
}

type AppendApplicationEventInput = {
  userId: string;
  applicationId: string;
  eventType: EventType;
  title: string;
  aiProvider?: string | null;
  aiNote?: string | null;
  eventTime?: Date | null;
  windowStartAt?: Date | null;
  deadlineAt?: Date | null;
  receivedAt?: Date | null;
  relativeValidityMinutes?: number | null;
  artifactName?: string | null;
  artifactUrl?: string | null;
  detailsJson: string;
};

/** Appends an event without inferring or changing an application stage. */
export async function appendApplicationEvent({ userId, applicationId, ...event }: AppendApplicationEventInput, transaction?: Prisma.TransactionClient) {
  const client = transaction ?? prisma;
  const application = await client.application.findFirst({
    where: { id: applicationId, jobLead: { ownerId: userId } },
    select: { id: true }
  });

  if (!application) {
    throw new ApplicationNotFoundError();
  }

  return client.event.create({
    data: {
      applicationId: application.id,
      ...event
    }
  });
}

export type ApplicationEventPatch = {
  eventType?: EventType;
  status?: EventStatus;
  title?: string;
  eventTime?: Date | null;
  windowStartAt?: Date | null;
  deadlineAt?: Date | null;
  receivedAt?: Date | null;
  relativeValidityMinutes?: number | null;
  content?: string;
  requirements?: string[];
};

export function validateApplicationEventTime(values: EventTimeInput) {
  if (values.windowStartAt && values.deadlineAt && values.windowStartAt > values.deadlineAt) {
    throw new ApplicationEventUpdateError("INVALID_TIME_RANGE");
  }
  if (
    values.relativeValidityMinutes !== null &&
    (!Number.isInteger(values.relativeValidityMinutes) || values.relativeValidityMinutes <= 0 || values.relativeValidityMinutes > 60 * 24 * 365)
  ) {
    throw new ApplicationEventUpdateError("INVALID_RELATIVE_VALIDITY");
  }
  if (values.relativeValidityMinutes !== null && values.receivedAt === null) {
    throw new ApplicationEventUpdateError("RECEIVED_AT_REQUIRED");
  }
}

type UpdateApplicationEventInput = {
  userId: string;
  eventId: string;
  expectedApplicationId?: string;
  targetApplicationId?: string;
  patch: ApplicationEventPatch;
};

/** Updates one owned canonical event in place. Web and confirmed Agent proposals share this mutation. */
export async function updateApplicationEvent({
  userId,
  eventId,
  expectedApplicationId,
  targetApplicationId,
  patch
}: UpdateApplicationEventInput, transaction?: Prisma.TransactionClient) {
  const run = async (tx: Prisma.TransactionClient) => {
    const event = await tx.event.findFirst({
      where: { id: eventId, application: { jobLead: { ownerId: userId } } },
      select: {
        id: true,
        applicationId: true,
        eventTime: true,
        windowStartAt: true,
        deadlineAt: true,
        receivedAt: true,
        relativeValidityMinutes: true,
        detailsJson: true,
        application: { select: { jobLeadId: true } }
      }
    });

    if (!event) throw new ApplicationEventUpdateError("NOT_FOUND");
    if (expectedApplicationId !== undefined && event.applicationId !== expectedApplicationId) {
      throw new ApplicationEventUpdateError("APPLICATION_MISMATCH");
    }

    const finalEventTime = patch.eventTime === undefined ? event.eventTime : patch.eventTime;
    const finalWindowStartAt = patch.windowStartAt === undefined ? event.windowStartAt : patch.windowStartAt;
    const finalDeadlineAt = patch.deadlineAt === undefined ? event.deadlineAt : patch.deadlineAt;
    const finalReceivedAt = patch.receivedAt === undefined ? event.receivedAt : patch.receivedAt;
    const finalRelativeValidityMinutes = patch.relativeValidityMinutes === undefined
      ? event.relativeValidityMinutes
      : patch.relativeValidityMinutes;

    validateApplicationEventTime({
      eventTime: finalEventTime,
      windowStartAt: finalWindowStartAt,
      deadlineAt: finalDeadlineAt,
      receivedAt: finalReceivedAt,
      relativeValidityMinutes: finalRelativeValidityMinutes
    });

    let targetApplication: { id: string; jobLeadId: string } | null = null;
    if (targetApplicationId !== undefined) {
      targetApplication = await tx.application.findFirst({
        where: { id: targetApplicationId, jobLead: { ownerId: userId } },
        select: { id: true, jobLeadId: true }
      });
      if (!targetApplication) throw new ApplicationEventUpdateError("TARGET_APPLICATION_NOT_FOUND");
    }

    const patchesDetails = patch.content !== undefined || patch.requirements !== undefined;
    const detailsJson = patchesDetails
      ? JSON.stringify({
          ...parseEventDetailsObject(event.detailsJson),
          ...(patch.content !== undefined ? { content: patch.content } : {}),
          ...(patch.requirements !== undefined ? { requirements: patch.requirements } : {})
        })
      : event.detailsJson;

    const updatedEvent = await tx.event.update({
      where: { id: event.id },
      data: {
        ...(targetApplication ? { applicationId: targetApplication.id } : {}),
        ...(patch.eventType !== undefined ? { eventType: patch.eventType } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.eventTime !== undefined ? { eventTime: patch.eventTime } : {}),
        ...(patch.windowStartAt !== undefined ? { windowStartAt: patch.windowStartAt } : {}),
        ...(patch.deadlineAt !== undefined ? { deadlineAt: patch.deadlineAt } : {}),
        ...(patch.receivedAt !== undefined ? { receivedAt: patch.receivedAt } : {}),
        ...(patch.relativeValidityMinutes !== undefined ? { relativeValidityMinutes: patch.relativeValidityMinutes } : {}),
        ...(patchesDetails ? { detailsJson } : {})
      },
      select: { id: true, applicationId: true }
    });

    return {
      event: updatedEvent,
      previousApplicationId: event.applicationId,
      previousJobLeadId: event.application.jobLeadId,
      applicationId: updatedEvent.applicationId,
      jobLeadId: targetApplication?.jobLeadId ?? event.application.jobLeadId,
      finalTime: {
        eventTime: finalEventTime,
        windowStartAt: finalWindowStartAt,
        deadlineAt: finalDeadlineAt,
        receivedAt: finalReceivedAt,
        relativeValidityMinutes: finalRelativeValidityMinutes
      }
    };
  };

  return transaction ? run(transaction) : prisma.$transaction(run);
}

function parseEventDetailsObject(detailsJson: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(detailsJson);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}
