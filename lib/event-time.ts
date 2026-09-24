export type EffectiveDueReason = "RELATIVE_VALIDITY" | "DEADLINE" | null;

export interface EventTimeInput {
  eventTime: Date | null;
  windowStartAt: Date | null;
  deadlineAt: Date | null;
  receivedAt: Date | null;
  relativeValidityMinutes: number | null;
}

export interface EventTimeResolution {
  eventAt: Date | null;
  windowStartAt: Date | null;
  deadlineAt: Date | null;
  validUntil: Date | null;
  effectiveDueAt: Date | null;
  effectiveDueReason: EffectiveDueReason;
}

/**
 * Resolves the time constraints for an event without reading or writing data.
 */
export function resolveEventTime({
  eventTime,
  windowStartAt,
  deadlineAt,
  receivedAt,
  relativeValidityMinutes,
}: EventTimeInput): EventTimeResolution {
  const validUntil =
    receivedAt !== null &&
    relativeValidityMinutes !== null &&
    Number.isInteger(relativeValidityMinutes) &&
    relativeValidityMinutes > 0
      ? new Date(receivedAt.getTime() + relativeValidityMinutes * 60_000)
      : null;

  if (validUntil !== null && (deadlineAt === null || validUntil <= deadlineAt)) {
    return {
      eventAt: eventTime,
      windowStartAt,
      deadlineAt,
      validUntil,
      effectiveDueAt: validUntil,
      effectiveDueReason: "RELATIVE_VALIDITY",
    };
  }

  return {
    eventAt: eventTime,
    windowStartAt,
    deadlineAt,
    validUntil,
    effectiveDueAt: deadlineAt,
    effectiveDueReason: deadlineAt === null ? null : "DEADLINE",
  };
}

export function formatDashboardEventTime(values: EventTimeInput) {
  if (values.eventTime) return formatDateTime(values.eventTime);

  if (values.windowStartAt && values.deadlineAt) {
    return formatRange(values.windowStartAt, values.deadlineAt);
  }

  const resolved = resolveEventTime(values);
  if (values.receivedAt && resolved.validUntil) {
    return formatRange(values.receivedAt, resolved.validUntil);
  }

  if (values.deadlineAt) return `截至 ${formatDateTime(values.deadlineAt)}`;
  return "时间待确认";
}

export function getDashboardEventDueAt(values: EventTimeInput) {
  const resolved = resolveEventTime(values);
  return values.eventTime ?? resolved.effectiveDueAt;
}

/** Calendar dates use the same precedence as the dashboard calendar. */
export function getCalendarEventDates(values: EventTimeInput) {
  if (values.eventTime) return [values.eventTime];
  if (values.windowStartAt && values.deadlineAt) return uniqueDates([values.windowStartAt, values.deadlineAt]);

  const { validUntil } = resolveEventTime(values);
  if (validUntil) return [validUntil];
  if (values.deadlineAt) return [values.deadlineAt];
  return [];
}

function formatRange(start: Date, end: Date) {
  const startText = formatDateTime(start);
  const sameDay = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth() && start.getDate() === end.getDate();
  return `${startText}–${sameDay ? formatTime(end) : formatDateTime(end)}`;
}

function formatDateTime(value: Date) {
  return `${value.getMonth() + 1}/${value.getDate()} ${formatTime(value)}`;
}

function formatTime(value: Date) {
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}

function uniqueDates(values: Date[]) {
  return values.filter((value, index) => values.findIndex((candidate) => candidate.getTime() === value.getTime()) === index);
}
