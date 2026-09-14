import type { ApplicationStage } from "@prisma/client";

export type WorkflowEvent = {
  id: string;
  applicationId: string;
  eventType: string;
  eventTime: Date | null;
  createdAt: Date;
};

export type WorkflowItem = {
  id: string;
  href: string;
  companyName: string;
  roleTitle: string;
  stage: ApplicationStage;
  reason: string;
  timeLabel: string;
  timeAt: Date;
  priority: number;
};

const dayMs = 24 * 60 * 60 * 1000;

/**
 * A key intentionally ignores imported event IDs: importing the same critical
 * notification twice must not create two workflow prompts.
 */
export function getCriticalEventKey(event: WorkflowEvent) {
  return event.eventTime
    ? `${event.applicationId}:${event.eventType}:${event.eventTime.getTime()}`
    : event.id;
}

export function uniqueCriticalEvents<T extends WorkflowEvent>(events: T[]) {
  const seen = new Set<string>();

  return events.filter((event) => {
    const key = getCriticalEventKey(event);
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

export function sortWorkflowItems(items: WorkflowItem[]) {
  return [...items].sort((left, right) => {
    if (left.priority !== right.priority) return left.priority - right.priority;
    if (left.timeAt.getTime() !== right.timeAt.getTime()) return left.timeAt.getTime() - right.timeAt.getTime();
    return left.id.localeCompare(right.id);
  });
}

export function getRemainingDays(deadlineAt: Date, now: Date) {
  return Math.max(1, Math.ceil((deadlineAt.getTime() - now.getTime()) / dayMs));
}
