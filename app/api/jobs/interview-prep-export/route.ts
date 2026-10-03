import { ApplicationStage } from "@prisma/client";
import { prisma } from "@/lib/db";
import { buildInterviewPrepMarkdown, interviewPrepFileName } from "@/lib/interview-prep-export";
import { ConfirmedResumeDocumentError, loadConfirmedResumeDocument } from "@/lib/resume-parsing/confirmed";
import { requireSessionUser } from "@/lib/session";

export const runtime = "nodejs";

const interviewPrepStages = [
  ApplicationStage.APPLIED,
  ApplicationStage.ASSESSMENT,
  ApplicationStage.WRITTEN_TEST,
  ApplicationStage.INTERVIEW,
  ApplicationStage.FIRST_INTERVIEW,
  ApplicationStage.SECOND_INTERVIEW,
  ApplicationStage.THIRD_INTERVIEW,
  ApplicationStage.FINAL_INTERVIEW,
  ApplicationStage.NEGOTIATION,
  ApplicationStage.OFFER
] as const;

export async function GET() {
  const user = await requireSessionUser();
  const applications = await prisma.application.findMany({
    where: {
      currentStage: { in: [...interviewPrepStages] },
      jobLead: { ownerId: user.id }
    },
    select: {
      id: true,
      currentStage: true,
      appliedAt: true,
      nextAction: true,
      note: true,
      updatedAt: true,
      usedResume: { select: { id: true, ownerId: true, title: true, isPrimary: true } },
      jobLead: {
        select: {
          companyName: true,
          roleTitle: true,
          city: true,
          industry: true,
          sourceName: true,
          sourceUrl: true,
          responsibilities: true,
          requirements: true,
          rawContent: true
        }
      },
      events: {
        select: {
          id: true,
          eventType: true,
          status: true,
          title: true,
          eventTime: true,
          windowStartAt: true,
          deadlineAt: true,
          createdAt: true,
          detailsJson: true
        }
      }
    },
    orderBy: [{ currentStage: "asc" }, { updatedAt: "desc" }, { id: "asc" }]
  });

  const ownedResumeIds = [...new Set(applications
    .map((application) => application.usedResume)
    .filter((resume) => resume?.ownerId === user.id)
    .map((resume) => resume!.id))];
  const confirmedEntries = await Promise.all(ownedResumeIds.map(async (resumeId) => {
    try {
      const confirmed = await loadConfirmedResumeDocument({ userId: user.id, resumeId });
      return [resumeId, confirmed.document] as const;
    } catch (error) {
      if (error instanceof ConfirmedResumeDocumentError) return null;
      throw error;
    }
  }));
  const confirmedResumes = new Map(confirmedEntries.filter((entry): entry is NonNullable<typeof entry> => entry !== null));
  const exportApplications = applications.map((application) => ({
    ...application,
    usedResume: application.usedResume?.ownerId === user.id
      ? {
          id: application.usedResume.id,
          title: application.usedResume.title,
          isPrimary: application.usedResume.isPrimary
        }
      : null
  }));
  const generatedAt = new Date();
  const markdown = buildInterviewPrepMarkdown(exportApplications, confirmedResumes, generatedAt);
  const fileName = interviewPrepFileName(generatedAt);

  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store"
    }
  });
}
