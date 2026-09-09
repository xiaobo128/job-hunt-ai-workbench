import { prisma, withDbRetry } from "@/lib/db";
import { requireSessionUser } from "@/lib/session";

export async function getDashboardData() {
  const user = await requireSessionUser();

  const [jobsCount, resumesCount, applicationsCount, recentJobs, recentEvents, needsReviewJobs, fallbackItems] =
    await withDbRetry("getDashboardData", () =>
      Promise.all([
        prisma.jobLead.count({
          where: { ownerId: user.id }
        }),
        prisma.resume.count({
          where: { ownerId: user.id }
        }),
        prisma.application.count({
          where: { jobLead: { ownerId: user.id } }
        }),
        prisma.jobLead.findMany({
          where: { ownerId: user.id },
          include: { application: true },
          orderBy: { updatedAt: "desc" },
          take: 5
        }),
        prisma.event.findMany({
          where: { application: { jobLead: { ownerId: user.id } } },
          include: { application: { include: { jobLead: true } } },
          orderBy: { createdAt: "desc" },
          take: 5
        }),
        prisma.jobLead.findMany({
          where: { ownerId: user.id, needsReview: true },
          orderBy: { createdAt: "desc" },
          take: 5
        }),
        prisma.jobLead.findMany({
          where: {
            ownerId: user.id,
            OR: [{ parseProvider: "local" }, { parseNote: { contains: "fallback" } }]
          },
          orderBy: { updatedAt: "desc" },
          take: 5
        })
      ])
    );

  return {
    jobsCount,
    resumesCount,
    applicationsCount,
    recentJobs,
    recentEvents,
    needsReviewJobs,
    fallbackItems
  };
}

export async function getJobs() {
  const user = await requireSessionUser();

  return withDbRetry("getJobs", () =>
    prisma.jobLead.findMany({
      where: { ownerId: user.id },
      include: {
        application: {
          select: {
            id: true,
            currentStage: true,
            submissionChannel: true,
            nextAction: true,
            note: true,
            updatedAt: true
          }
        },
        resumeVariants: {
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            title: true,
            note: true,
            jobLeadId: true,
            resume: {
              select: {
                id: true,
                title: true
              }
            }
          }
        }
      },
      orderBy: { updatedAt: "desc" }
    })
  );
}

export async function getJobById(id: string) {
  const user = await requireSessionUser();

  return withDbRetry("getJobById", () =>
    prisma.jobLead.findFirst({
      where: { id, ownerId: user.id },
      include: {
        application: { include: { events: true } },
        tailorRuns: { include: { resume: true }, orderBy: { createdAt: "desc" } },
        resumeVariants: { include: { resume: true }, orderBy: { createdAt: "desc" } },
        agentRuns: {
          include: {
            resume: true,
            event: true
          },
          orderBy: { createdAt: "desc" },
          take: 8
        }
      }
    })
  );
}

export async function getBoardData() {
  const user = await requireSessionUser();

  return withDbRetry("getBoardData", () =>
    prisma.application.findMany({
      where: { jobLead: { ownerId: user.id } },
      include: { jobLead: true, events: true },
      orderBy: { updatedAt: "desc" }
    })
  );
}

export async function getResumes() {
  const user = await requireSessionUser();

  return withDbRetry("getResumes", () =>
    prisma.resume.findMany({
      where: { ownerId: user.id },
      include: {
        assets: { orderBy: { createdAt: "asc" } },
        variants: { include: { jobLead: true }, orderBy: { createdAt: "desc" } }
      },
      orderBy: { updatedAt: "desc" }
    })
  );
}
