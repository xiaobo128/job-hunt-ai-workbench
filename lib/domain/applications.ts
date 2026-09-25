import { ApplicationStage, EventType, Prisma } from "@prisma/client";
import { prisma } from "../db";

export class ApplicationNotFoundError extends Error {
  constructor() {
    super("Application not found");
    this.name = "ApplicationNotFoundError";
  }
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
