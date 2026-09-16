import { prisma, withDbRetry } from "@/lib/db";
import { requireSessionUser } from "@/lib/session";
import { getRemainingDays, sortWorkflowItems, uniqueCriticalEvents, type DashboardWorkflowItem } from "@/lib/workflow";
import { formatDashboardEventTime, getDashboardEventDueAt } from "@/lib/event-time";

export async function getDashboardData() {
  const user = await requireSessionUser();
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
  const activeApplicationWhere = {
    currentStage: { not: "CLOSED" as const },
    jobLead: { ownerId: user.id, status: { not: "CLOSED" as const } }
  };

  const [applications, deadlineEvents, scheduleEvents, recentEvents, calendarEvents] = await withDbRetry("getDashboardData", () =>
    Promise.all([
        prisma.application.findMany({
          where: activeApplicationWhere,
          select: {
            id: true,
            appliedAt: true,
            currentStage: true,
            nextAction: true,
            nextActionDueAt: true,
            updatedAt: true,
            jobLead: { select: { id: true, companyName: true, roleTitle: true } }
          }
        }),
        prisma.event.findMany({
          where: {
            eventType: "DEADLINE",
            status: "ACTIVE",
            application: activeApplicationWhere
          },
          select: {
            id: true,
            applicationId: true,
            eventType: true,
            eventTime: true,
            windowStartAt: true,
            deadlineAt: true,
            receivedAt: true,
            relativeValidityMinutes: true,
            status: true,
            createdAt: true,
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
          orderBy: [{ eventTime: "asc" }, { id: "asc" }]
        }),
        prisma.event.findMany({
          where: {
            eventType: { in: ["ASSESSMENT", "INTERVIEW"] },
            status: "ACTIVE",
            application: activeApplicationWhere
          },
          select: {
            id: true,
            applicationId: true,
            eventType: true,
            eventTime: true,
            windowStartAt: true,
            deadlineAt: true,
            receivedAt: true,
            relativeValidityMinutes: true,
            status: true,
            createdAt: true,
            application: {
              select: {
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
          orderBy: [{ eventTime: "asc" }, { id: "asc" }]
        }),
        prisma.event.findMany({
          where: { application: activeApplicationWhere },
          select: {
            id: true,
            applicationId: true,
            eventType: true,
            eventTime: true,
            status: true,
            title: true,
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
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          take: 30
        }),
        prisma.event.findMany({
          where: {
            status: { not: "IGNORED" },
            application: activeApplicationWhere,
            OR: [
              { eventTime: { not: null } },
              { windowStartAt: { not: null } },
              { deadlineAt: { not: null } },
              { receivedAt: { not: null }, relativeValidityMinutes: { not: null } }
            ]
          },
          select: {
            id: true,
            applicationId: true,
            eventType: true,
            eventTime: true,
            windowStartAt: true,
            deadlineAt: true,
            receivedAt: true,
            relativeValidityMinutes: true,
            status: true,
            createdAt: true,
            title: true,
            application: { select: { jobLead: { select: { id: true, companyName: true, roleTitle: true } } } }
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }]
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

  for (const event of uniqueCriticalEvents(deadlineEvents)) {
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

  const todayActionItems: DashboardWorkflowItem[] = [];
  const deadlineActionJobIds = new Set<string>();
  const unappliedStages = new Set(["INTERESTED", "READY_TO_APPLY"]);

  for (const event of uniqueCriticalEvents(deadlineEvents)) {
    const job = event.application.jobLead;
    const dueAt = getDashboardEventDueAt(event);
    if (
      !dueAt ||
      dueAt < now ||
      dueAt > windowEnd ||
      event.application.appliedAt ||
      !unappliedStages.has(event.application.currentStage)
    ) {
      continue;
    }

    if (deadlineActionJobIds.has(job.id)) continue;

    const remainingDays = getRemainingDays(dueAt, now);
    deadlineActionJobIds.add(job.id);
    todayActionItems.push({
      id: `deadline:${job.id}`,
      href: `/notifications/${event.applicationId}`,
      applicationId: event.applicationId,
      sourceType: "EVENT",
      eventId: event.id,
      companyName: job.companyName,
      roleTitle: job.roleTitle,
      stage: event.application.currentStage,
      reason: `尚未投递，距离截止还有 ${remainingDays} 天`,
      timeLabel: "截止时间",
      displayTime: formatDashboardEventTime(event),
      timeAt: dueAt,
      priority: 1
    });
  }

  for (const event of uniqueCriticalEvents(scheduleEvents)) {
    const dueAt = getDashboardEventDueAt(event);
    if (!dueAt || dueAt < now || dueAt > windowEnd) continue;

    const job = event.application.jobLead;
    todayActionItems.push({
      id: `schedule:${event.id}`,
      href: `/notifications/${event.applicationId}`,
      applicationId: event.applicationId,
      sourceType: "EVENT",
      eventId: event.id,
      companyName: job.companyName,
      roleTitle: job.roleTitle,
      stage: event.application.currentStage,
      reason: event.eventType === "INTERVIEW" ? "即将参加面试" : "即将参加笔试",
      timeLabel: "安排时间",
      displayTime: formatDashboardEventTime(event),
      timeAt: dueAt,
      priority: 2
    });
  }

  for (const application of applications) {
    const nextAction = application.nextAction?.trim();
    if (!nextAction) continue;

    todayActionItems.push({
      id: `next-action:${application.id}`,
      href: `/jobs/${application.jobLead.id}`,
      applicationId: application.id,
      sourceType: "NEXT_ACTION",
      companyName: application.jobLead.companyName,
      roleTitle: application.jobLead.roleTitle,
      stage: application.currentStage,
      reason: nextAction,
      timeLabel: application.nextActionDueAt ? "行动截止" : "最近更新",
      displayTime: application.nextActionDueAt ? `截至 ${formatDashboardDateTime(application.nextActionDueAt)}` : "待跟进",
      timeAt: application.nextActionDueAt ?? application.updatedAt,
      priority: 3
    });
  }

  const recentTimelineEvents = uniqueCriticalEvents(recentEvents).slice(0, 10);
  const progress = {
    readyToApply: 0,
    applied: 0,
    assessment: 0,
    interview: 0,
    offer: 0
  };

  for (const application of applications) {
    if (application.currentStage === "INTERESTED" || application.currentStage === "READY_TO_APPLY") progress.readyToApply += 1;
    else if (application.currentStage === "APPLIED") progress.applied += 1;
    else if (application.currentStage === "ASSESSMENT") progress.assessment += 1;
    else if (["INTERVIEW", "FIRST_INTERVIEW", "SECOND_INTERVIEW", "THIRD_INTERVIEW", "FINAL_INTERVIEW"].includes(application.currentStage)) progress.interview += 1;
    else if (application.currentStage === "OFFER") progress.offer += 1;
  }

  return {
    upcomingDeadlineJobs,
    upcomingScheduleEvents: uniqueCriticalEvents(scheduleEvents).slice(0, 10),
    recentTimelineEvents,
    todayActionItems: sortWorkflowItems(todayActionItems).slice(0, 10),
    calendarEvents,
    progress
  };
}

function formatDashboardDateTime(value: Date) {
  return `${value.getMonth() + 1}/${value.getDate()} ${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
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
