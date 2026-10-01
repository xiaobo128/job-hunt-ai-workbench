import assert from "node:assert/strict";
import test from "node:test";

import {
  formatWallClockDate,
  formatWallClockDateTime,
  formatWallClockDateTimeInput,
  parseWallClockDate,
  parseWallClockDateTime
} from "./wall-clock.ts";

test("keeps entered calendar fields when the input has no timezone", () => {
  const value = parseWallClockDateTime("2026-10-01T14:35");
  assert.equal(formatWallClockDateTime(value), "2026-10-01T14:35:00");
  assert.equal(formatWallClockDateTimeInput(value), "2026-10-01T14:35");
});

test("does not shift calendar fields from timezone-suffixed input", () => {
  assert.equal(
    formatWallClockDateTime(parseWallClockDateTime("2026-10-01T14:35:20.125+08:00")),
    "2026-10-01T14:35:20.125"
  );
  assert.equal(
    formatWallClockDateTime(parseWallClockDateTime("2026-10-01T14:35:20Z")),
    "2026-10-01T14:35:20"
  );
});

test("validates real calendar dates", () => {
  assert.equal(formatWallClockDate(parseWallClockDate("2026-02-28")), "2026-02-28");
  assert.equal(parseWallClockDate("2026-02-30"), null);
  assert.equal(parseWallClockDateTime("2026-10-01T25:00"), null);
});
