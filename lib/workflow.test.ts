import { strict as assert } from "node:assert";
import { test } from "node:test";
import { sortWorkflowItems, uniqueCriticalEvents } from "./workflow";

test("uniqueCriticalEvents only collapses the same timed critical event", () => {
  const eventTime = new Date("2026-09-16T09:00:00.000Z");
  const events = uniqueCriticalEvents([
    { id: "first", applicationId: "application-1", eventType: "INTERVIEW", eventTime, createdAt: eventTime },
    { id: "duplicate", applicationId: "application-1", eventType: "INTERVIEW", eventTime, createdAt: eventTime },
    { id: "note-1", applicationId: "application-1", eventType: "NOTE", eventTime: null, createdAt: eventTime },
    { id: "note-2", applicationId: "application-1", eventType: "NOTE", eventTime: null, createdAt: eventTime }
  ]);

  assert.deepEqual(events.map((event) => event.id), ["first", "note-1", "note-2"]);
});

test("sortWorkflowItems keeps urgent groups first and has a deterministic tie-breaker", () => {
  const at = new Date("2026-09-16T09:00:00.000Z");
  const items = sortWorkflowItems([
    { id: "b", href: "/jobs/b", companyName: "B", roleTitle: "R", stage: "APPLIED", reason: "下一步", timeLabel: "更新", timeAt: at, priority: 3 },
    { id: "deadline", href: "/jobs/d", companyName: "D", roleTitle: "R", stage: "READY_TO_APPLY", reason: "截止", timeLabel: "截止", timeAt: at, priority: 1 },
    { id: "a", href: "/jobs/a", companyName: "A", roleTitle: "R", stage: "APPLIED", reason: "下一步", timeLabel: "更新", timeAt: at, priority: 3 }
  ]);

  assert.deepEqual(items.map((item) => item.id), ["deadline", "a", "b"]);
});
