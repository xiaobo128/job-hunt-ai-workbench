import { ApplicationStage, EventType, Prisma, SourceType } from "@prisma/client";
import { prisma } from "../db";

export class ApplicationNotFoundError extends Error {
  constructor() {
    super("Application not found");
    this.name = "ApplicationNotFoundError";
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
