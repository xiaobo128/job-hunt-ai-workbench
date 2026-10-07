import assert from "node:assert/strict";
import test from "node:test";
import { ApplicationEventUpdateError, updateApplicationEvent } from "./applications";

const originalDetails = {
  content: "original content",
  requirements: ["身份证"],
  actions: ["完成测评"],
  receivedAtRaw: "2026-10-01 14:20",
  extraction: {
    schedule: { rawText: "收到后 7 天内" },
    deliveryMode: "ONLINE",
    deliveryModeRawText: "线上完成",
    onlineUrl: "https://example.com/assessment",
    offlineAddress: "深圳市南山区"
  },
  unknownFutureField: { preserved: true }
};

function ownedEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "event-1",
    applicationId: "application-1",
    eventTime: null,
    windowStartAt: null,
    deadlineAt: null,
    receivedAt: new Date("2026-10-01T14:20:00.000Z"),
    relativeValidityMinutes: 7 * 24 * 60,
    detailsJson: JSON.stringify(originalDetails),
    application: { jobLeadId: "job-1" },
    ...overrides
  };
}

function transaction(eventValue: ReturnType<typeof ownedEvent> | null = ownedEvent()) {
  const writes: Array<Record<string, unknown>> = [];
  const tx = {
    event: {
      findFirst: async () => eventValue,
      update: async (input: Record<string, unknown>) => {
        writes.push(input);
        const data = input.data as Record<string, unknown>;
        return { id: "event-1", applicationId: (data.applicationId as string | undefined) ?? eventValue?.applicationId ?? "application-1" };
      }
    },
    application: {
      findFirst: async ({ where }: { where: { id: string } }) => where.id === "application-2" ? { id: "application-2", jobLeadId: "job-2" } : null
    }
  };
  return { tx, writes };
}

test("deadline-only update changes the same Event without creating another Event or rewriting detailsJson", async () => {
  const { tx, writes } = transaction();
  const deadlineAt = new Date("2026-10-08T14:20:00.000Z");
  const result = await updateApplicationEvent({
    userId: "user-a",
    eventId: "event-1",
    expectedApplicationId: "application-1",
    patch: { deadlineAt }
  }, tx as never);

  assert.equal(result.event.id, "event-1");
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0], {
    where: { id: "event-1" },
    data: { deadlineAt },
    select: { id: true, applicationId: true }
  });
  assert.equal("create" in tx.event, false);
});

test("content-only patch preserves requirements, evidence, extraction, URLs, addresses, and unknown fields", async () => {
  const { tx, writes } = transaction();
  await updateApplicationEvent({ userId: "user-a", eventId: "event-1", patch: { content: "updated content" } }, tx as never);
  const saved = JSON.parse(((writes[0].data as Record<string, unknown>).detailsJson as string));

  assert.equal(saved.content, "updated content");
  assert.deepEqual(saved.requirements, originalDetails.requirements);
  assert.deepEqual(saved.actions, originalDetails.actions);
  assert.equal(saved.receivedAtRaw, originalDetails.receivedAtRaw);
  assert.deepEqual(saved.extraction, originalDetails.extraction);
  assert.deepEqual(saved.unknownFutureField, originalDetails.unknownFutureField);
});

test("requirements-only patch preserves every other detailsJson field", async () => {
  const { tx, writes } = transaction();
  await updateApplicationEvent({ userId: "user-a", eventId: "event-1", patch: { requirements: ["护照"] } }, tx as never);
  const saved = JSON.parse(((writes[0].data as Record<string, unknown>).detailsJson as string));

  assert.deepEqual(saved.requirements, ["护照"]);
  assert.equal(saved.content, originalDetails.content);
  assert.deepEqual(saved.actions, originalDetails.actions);
  assert.deepEqual(saved.extraction, originalDetails.extraction);
  assert.deepEqual(saved.unknownFutureField, originalDetails.unknownFutureField);
});

test("Web may reassign an Event only to another owned Application", async () => {
  const { tx, writes } = transaction();
  const result = await updateApplicationEvent({
    userId: "user-a",
    eventId: "event-1",
    targetApplicationId: "application-2",
    patch: { title: "updated" }
  }, tx as never);
  assert.equal(result.applicationId, "application-2");
  assert.equal(result.jobLeadId, "job-2");
  assert.deepEqual((writes[0].data as Record<string, unknown>).applicationId, "application-2");

  await assert.rejects(
    updateApplicationEvent({ userId: "user-a", eventId: "event-1", targetApplicationId: "other-user-application", patch: { title: "updated" } }, tx as never),
    (error) => error instanceof ApplicationEventUpdateError && error.code === "TARGET_APPLICATION_NOT_FOUND"
  );
});

test("Agent relation and ownership checks reject a wrong Application or an unowned Event", async () => {
  const owned = transaction();
  await assert.rejects(
    updateApplicationEvent({ userId: "user-a", eventId: "event-1", expectedApplicationId: "application-2", patch: { title: "updated" } }, owned.tx as never),
    (error) => error instanceof ApplicationEventUpdateError && error.code === "APPLICATION_MISMATCH"
  );

  const unowned = transaction(null);
  await assert.rejects(
    updateApplicationEvent({ userId: "user-b", eventId: "event-1", expectedApplicationId: "application-1", patch: { title: "updated" } }, unowned.tx as never),
    (error) => error instanceof ApplicationEventUpdateError && error.code === "NOT_FOUND"
  );
});

test("final Event time state is validated after applying a partial patch", async () => {
  const missingReceivedAt = transaction(ownedEvent({ receivedAt: null, relativeValidityMinutes: null }));
  await assert.rejects(
    updateApplicationEvent({ userId: "user-a", eventId: "event-1", patch: { relativeValidityMinutes: 60 } }, missingReceivedAt.tx as never),
    (error) => error instanceof ApplicationEventUpdateError && error.code === "RECEIVED_AT_REQUIRED"
  );

  const invalidWindow = transaction(ownedEvent({ windowStartAt: new Date("2026-10-09T10:00:00.000Z") }));
  await assert.rejects(
    updateApplicationEvent({ userId: "user-a", eventId: "event-1", patch: { deadlineAt: new Date("2026-10-08T10:00:00.000Z") } }, invalidWindow.tx as never),
    (error) => error instanceof ApplicationEventUpdateError && error.code === "INVALID_TIME_RANGE"
  );
});
