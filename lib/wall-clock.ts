/**
 * User-entered business times are wall-clock values, not instants in a timezone.
 *
 * Prisma represents PostgreSQL `timestamp without time zone` values as `Date`, so
 * we keep the entered calendar fields in the Date's UTC fields.  Never pass these
 * values through the host/browser local timezone when parsing or formatting.
 */
const DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3})\d*)?)?(?:Z|[+-]\d{2}:?\d{2})?$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseWallClockDateTime(value: string): Date | null {
  const match = DATE_TIME_PATTERN.exec(value.trim());
  if (!match) return null;

  return dateFromParts(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] ?? 0),
    Number((match[7] ?? "").padEnd(3, "0") || 0)
  );
}

export function parseWallClockDate(value: string): Date | null {
  const match = DATE_PATTERN.exec(value.trim());
  if (!match) return null;
  return dateFromParts(Number(match[1]), Number(match[2]), Number(match[3]), 0, 0, 0, 0);
}

export function formatWallClockDateTime(value: Date | string | null | undefined) {
  const date = wallClockDate(value);
  if (!date) return null;
  const milliseconds = date.getUTCMilliseconds();
  const fraction = milliseconds ? `.${String(milliseconds).padStart(3, "0")}` : "";
  return `${formatWallClockDate(date)}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}${fraction}`;
}

export function formatWallClockDateTimeInput(value: Date | string | null | undefined) {
  return formatWallClockDateTime(value)?.slice(0, 16) ?? "";
}

export function formatWallClockDate(value: Date | string | null | undefined) {
  const date = wallClockDate(value);
  if (!date) return "";
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function formatWallClockDisplay(value: Date | string | null | undefined) {
  const date = wallClockDate(value);
  if (!date) return "未设置";
  return `${pad(date.getUTCMonth() + 1)}/${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

function wallClockDate(value: Date | string | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  return parseWallClockDateTime(value) ?? parseWallClockDate(value);
}

function dateFromParts(year: number, month: number, day: number, hour: number, minute: number, second: number, millisecond: number) {
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second ||
    date.getUTCMilliseconds() !== millisecond
  ) return null;
  return date;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
