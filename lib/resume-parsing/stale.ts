export const RESUME_PARSE_STALE_AFTER_MS = 3 * 60 * 1000;

export function isResumeParseStale(updatedAt: Date, now = Date.now()) {
  return now - updatedAt.getTime() >= RESUME_PARSE_STALE_AFTER_MS;
}
