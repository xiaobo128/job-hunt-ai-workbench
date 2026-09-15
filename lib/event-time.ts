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
