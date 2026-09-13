import { prisma, withDbRetry } from "@/lib/db";
import { requireSessionUser } from "@/lib/session";

export async function getDashboardData() {
  const user = await requireSessionUser();
  const deadlineWindowStart = new Date();
  const deadlineWindowEnd = new Date(deadlineWindowStart.getTime() + 5 * 24 * 60 * 60 * 1000);
  const staleJobCutoff = new Date(deadlineWindowStart.getTime() - 5 * 24 * 60 * 60 * 1000);
  const recentNotificationCutoff = new Date(deadlineWindowStart.getTime() - 24 * 60 * 60 * 1000);

  const [
    jobsCount,
    resumesCount,
    applicationsCount,
    recentJobs,
    recentEvents,
    needsReviewJobs,
    fallbackItems,
    deadlineEvents,
    staleUnappliedJobs,
    upcomingScheduleEvents,
    recentNotificationEvents
  ] = await withDbRetry("getDashboardData", () =>
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
        }),
        prisma.event.findMany({
          where: {
            eventType: "DEADLINE",
            eventTime: {
              gte: deadlineWindowStart,
              lte: deadlineWindowEnd
            },
            application: {
              currentStage: { not: "CLOSED" },
              jobLead: {
                ownerId: user.id,
                status: { not: "CLOSED" }
              }
            }
          },
          select: {
            id: true,
            eventTime: true,
            application: {
              select: {
                appliedAt: true,
                currentStage: true,
                jobLead: {
                  select: {
                    id: true,
                    companyName: true,
                    roleTitle: true
                  }
                }
              }
            }
          },
          orderBy: { eventTime: "asc" }
        }),
        prisma.jobLead.findMany({
          where: {
            ownerId: user.id,
            createdAt: { lte: staleJobCutoff },
            status: { not: "CLOSED" },
            application: {
              is: {
                appliedAt: null,
                currentStage: { in: ["INTERESTED", "READY_TO_APPLY"] }
              }
            }
          },
          select: {
            id: true,
            companyName: true,
            roleTitle: true,
            createdAt: true
          },
          orderBy: { createdAt: "asc" }
        }),
        prisma.event.findMany({
          where: {
            eventType: { in: ["ASSESSMENT", "INTERVIEW"] },
            eventTime: {
              gte: deadlineWindowStart,
              lte: deadlineWindowEnd
            },
            application: {
              currentStage: { not: "CLOSED" },
              jobLead: {
                ownerId: user.id,
                status: { not: "CLOSED" }
              }
            }
          },
          select: {
            id: true,
            eventType: true,
            eventTime: true,
            application: {
              select: {
                jobLead: {
                  select: {
                    id: true,
                    companyName: true,
                    roleTitle: true
                  }
                }
              }
            }
          },
          orderBy: { eventTime: "asc" }
        }),
        prisma.event.findMany({
          where: {
            createdAt: { gte: recentNotificationCutoff },
            application: { jobLead: { ownerId: user.id } }
          },
          select: {
            id: true,
            eventType: true,
            createdAt: true,
            application: {
              select: {
                jobLead: {
                  select: {
                    id: true,
                    companyName: true,
                    roleTitle: true
                  }
                }
              }
            }
          },
          orderBy: { createdAt: "desc" }
        })
      ])
  );

  const upcomingDeadlineJobs = [] as Array<{
    id: string;
    companyName: string;
    roleTitle: string;
    deadlineAt: Date;
  }>;
  const seenDeadlineJobIds = new Set<string>();

  for (const event of deadlineEvents) {
    const job = event.application.jobLead;
    if (!event.eventTime || seenDeadlineJobIds.has(job.id)) continue;

    seenDeadlineJobIds.add(job.id);
    upcomingDeadlineJobs.push({
      id: job.id,
      companyName: job.companyName,
      roleTitle: job.roleTitle,
      deadlineAt: event.eventTime
    });
  }

  type TodayActionItem = {
    id: string;
    href: string;
    companyName: string;
    roleTitle: string;
    reason: string;
    timeLabel: string;
    timeAt: Date;
    priority: number;
  };

  const todayActionItems: TodayActionItem[] = [];
  const coveredEventIds = new Set<string>();
  const deadlineActionJobIds = new Set<string>();
  const unappliedStages = new Set(["INTERESTED", "READY_TO_APPLY"]);

  for (const event of deadlineEvents) {
    const job = event.application.jobLead;
    if (
      !event.eventTime ||
      event.application.appliedAt ||
      !unappliedStages.has(event.application.currentStage)
    ) {
      continue;
    }

    coveredEventIds.add(event.id);
    if (deadlineActionJobIds.has(job.id)) continue;

    const remainingDays = Math.max(
      1,
      Math.ceil((event.eventTime.getTime() - deadlineWindowStart.getTime()) / (24 * 60 * 60 * 1000))
    );
    deadlineActionJobIds.add(job.id);
    todayActionItems.push({
      id: `deadline:${job.id}`,
      href: `/jobs/${job.id}`,
      companyName: job.companyName,
      roleTitle: job.roleTitle,
      reason: `尚未投递，距离截止还有 ${remainingDays} 天`,
      timeLabel: "截止时间",
      timeAt: event.eventTime,
      priority: 1
    });
  }

  for (const job of staleUnappliedJobs) {
    const savedDays = Math.max(
      5,
      Math.floor((deadlineWindowStart.getTime() - job.createdAt.getTime()) / (24 * 60 * 60 * 1000))
    );
    todayActionItems.push({
      id: `stale:${job.id}`,
      href: `/jobs/${job.id}`,
      companyName: job.companyName,
      roleTitle: job.roleTitle,
      reason: `已保存 ${savedDays} 天，仍未投递`,
      timeLabel: "保存时间",
      timeAt: job.createdAt,
      priority: 2
    });
  }

  const seenScheduleReasons = new Set<string>();
  for (const event of upcomingScheduleEvents) {
    if (!event.eventTime) continue;

    const job = event.application.jobLead;
    const reasonKey = `${job.id}:${event.eventType}`;
    coveredEventIds.add(event.id);
    if (seenScheduleReasons.has(reasonKey)) continue;

    seenScheduleReasons.add(reasonKey);
    todayActionItems.push({
      id: `schedule:${reasonKey}`,
      href: `/jobs/${job.id}`,
      companyName: job.companyName,
      roleTitle: job.roleTitle,
      reason: event.eventType === "INTERVIEW" ? "即将参加面试" : "即将参加笔试",
      timeLabel: "安排时间",
      timeAt: event.eventTime,
      priority: 3
    });
  }

  const seenNotificationReasons = new Set<string>();
  for (const event of recentNotificationEvents) {
    const job = event.application.jobLead;
    const reasonKey = `${job.id}:${event.eventType}`;
    if (coveredEventIds.has(event.id) || seenNotificationReasons.has(reasonKey)) continue;

    seenNotificationReasons.add(reasonKey);
    todayActionItems.push({
      id: `notification:${event.id}`,
      href: "/notifications",
      companyName: job.companyName,
      roleTitle: job.roleTitle,
      reason: "最近导入的新通知，待查看",
      timeLabel: "导入时间",
      timeAt: event.createdAt,
      priority: 4
    });
  }

  todayActionItems.sort((left, right) => {
    if (left.priority !== right.priority) return left.priority - right.priority;
    if (left.priority === 4) return right.timeAt.getTime() - left.timeAt.getTime();
    return left.timeAt.getTime() - right.timeAt.getTime();
  });

  return {
    jobsCount,
    resumesCount,
    applicationsCount,
    recentJobs,
    recentEvents,
    needsReviewJobs,
    fallbackItems,
    upcomingDeadlineJobs,
    todayActionItems: todayActionItems.slice(0, 10)
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

  return withDbRetry("getResumes", async () => {
    const resumes = await prisma.resume.findMany({
      where: { ownerId: user.id },
      include: {
        assets: { orderBy: { createdAt: "asc" } },
        parseAttempts: {
          orderBy: { createdAt: "desc" },
          take: 1
        },
        variants: { include: { jobLead: true }, orderBy: { createdAt: "desc" } }
      },
      orderBy: { updatedAt: "desc" }
    });

    const confirmedParses = await prisma.resumeParse.findMany({
      where: {
        resumeId: { in: resumes.map((resume) => resume.id) },
        status: "CONFIRMED"
      },
      orderBy: { confirmedAt: "desc" }
    });
    const currentConfirmedByResumeId = new Map<string, (typeof confirmedParses)[number]>();
    for (const parse of confirmedParses) {
      if (!currentConfirmedByResumeId.has(parse.resumeId)) {
        currentConfirmedByResumeId.set(parse.resumeId, parse);
      }
    }

    return resumes.map((resume) => ({
      ...resume,
      currentConfirmedParse: currentConfirmedByResumeId.get(resume.id) ?? null
    }));
  });
}
