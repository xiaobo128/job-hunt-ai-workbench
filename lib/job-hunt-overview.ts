import type { EventStatus } from "@prisma/client";
import type { DashboardWorkflowItem } from "./workflow";
import { formatWallClockDateTime } from "./wall-clock";

type DashboardProgress = {
  readyToApply: number;
  applied: number;
  assessment: number;
  aiInterview: number;
  offer: number;
};

type DashboardUpcomingEvent = {
  id: string;
  applicationId: string;
  eventType: string;
  status: EventStatus;
  dueAt: Date;
  eventTime: Date | null;
  windowStartAt: Date | null;
  deadlineAt: Date | null;
  receivedAt: Date | null;
  relativeValidityMinutes: number | null;
  application: {
    jobLead: {
      companyName: string;
      roleTitle: string;
    };
  };
};

export type JobHuntOverviewDashboardData = {
  progress: DashboardProgress;
  todayActionItems: DashboardWorkflowItem[];
  upcomingEvents: DashboardUpcomingEvent[];
};

export function buildJobHuntOverview(data: JobHuntOverviewDashboardData, generatedAt = new Date()) {
  return {
    generatedAt: generatedAt.toISOString(),
    progress: data.progress,
    actionItems: data.todayActionItems.map((item) => ({
      applicationId: item.applicationId,
      companyName: item.companyName,
      roleTitle: item.roleTitle,
      stage: item.stage,
      sourceType: item.sourceType,
      reason: item.reason,
      displayTime: item.displayTime,
      taskStatus: item.taskStatus,
      timeAt: formatWallClockDateTime(item.timeAt),
      ...(item.eventId ? { eventId: item.eventId } : {}),
      ...(item.eventType ? { eventType: item.eventType } : {})
    })),
    upcomingEvents: data.upcomingEvents.map((event) => ({
      eventId: event.id,
      applicationId: event.applicationId,
      companyName: event.application.jobLead.companyName,
      roleTitle: event.application.jobLead.roleTitle,
      eventType: event.eventType,
      status: event.status,
      dueAt: formatWallClockDateTime(event.dueAt),
      eventTime: formatWallClockDateTime(event.eventTime),
      windowStartAt: formatWallClockDateTime(event.windowStartAt),
      deadlineAt: formatWallClockDateTime(event.deadlineAt),
      receivedAt: formatWallClockDateTime(event.receivedAt),
      relativeValidityMinutes: event.relativeValidityMinutes
    }))
  };
}
