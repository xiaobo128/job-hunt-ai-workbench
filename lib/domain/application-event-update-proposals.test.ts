import assert from "node:assert/strict";
import test from "node:test";
import { resolveEventTime } from "../event-time";
import {
  proposeRecruitmentEventUpdate,
  RecruitmentEventUpdateProposalError,
  type OwnedApplicationEventForUpdate
} from "./application-event-update-proposals";

function event(overrides: Partial<OwnedApplicationEventForUpdate> = {}): OwnedApplicationEventForUpdate {
  return {
    id: "event-1",
    applicationId: "application-1",
    eventType: "ASSESSMENT",
    status: "ACTIVE",
    title: "在线测评",
    eventTime: null,
    windowStartAt: null,
    deadlineAt: null,
    receivedAt: new Date("2026-10-01T14:20:00.000Z"),
    relativeValidityMinutes: 7 * 24 * 60,
    detailsJson: JSON.stringify({ content: "通知正文", requirements: ["身份证"] }),
    application: { jobLead: { companyName: "Example Co", roleTitle: "Product Manager" } },
    ...overrides
  };
}

function dependencies(current: OwnedApplicationEventForUpdate | null = event()) {
  const proposals: unknown[] = [];
  let eventWrites = 0;
  return {
    proposals,
    get eventWrites() { return eventWrites; },
    value: {
      findOwnedEvent: async () => current,
      createProposal: async (input: unknown) => {
        proposals.push(input);
        return { id: "proposal-1", status: "PENDING" } as never;
      },
      updateEvent: () => { eventWrites += 1; }
    }
  };
}

function code(error: unknown) {
  assert.ok(error instanceof RecruitmentEventUpdateProposalError);
  return error.code;
}

test("deadline derivation stores resolveEventTime().validUntil without mutating the Event", async () => {
  const deps = dependencies();
  const result = await proposeRecruitmentEventUpdate({
    userId: "user-a",
    input: { applicationId: "application-1", eventId: "event-1", deriveDeadlineFromRelativeValidity: true },
    dependencies: deps.value
  });
  const expected = resolveEventTime(event()).validUntil;
  const created = deps.proposals[0] as { input: { type: string; applicationId: string; payload: { eventId: string; patch: { deadlineAt: string } } } };

  assert.equal(created.input.type, "APPLICATION_EVENT_UPDATE");
  assert.equal(created.input.applicationId, "application-1");
  assert.equal(created.input.payload.eventId, "event-1");
  assert.equal(created.input.payload.patch.deadlineAt, "2026-10-08T14:20:00");
  assert.equal(new Date(`${created.input.payload.patch.deadlineAt}Z`).getTime(), expected?.getTime());
  assert.equal(deps.eventWrites, 0);
  assert.equal(result.current.deadlineAt, null);
  assert.equal(result.confirmationRequired, true);
});

test("deadline derivation uses patched receivedAt and relativeValidityMinutes", async () => {
  const deps = dependencies();
  await proposeRecruitmentEventUpdate({
    userId: "user-a",
    input: {
      applicationId: "application-1",
      eventId: "event-1",
      patch: { receivedAt: "2026-10-03T09:30", relativeValidityMinutes: 48 * 60 },
      deriveDeadlineFromRelativeValidity: true
    },
    dependencies: deps.value
  });
  const created = deps.proposals[0] as { input: { payload: { patch: Record<string, unknown> } } };
  assert.deepEqual(created.input.payload.patch, {
    receivedAt: "2026-10-03T09:30:00",
    relativeValidityMinutes: 2880,
    deadlineAt: "2026-10-05T09:30:00"
  });
});

test("derive plus explicit deadline is rejected", async () => {
  const deps = dependencies();
  await assert.rejects(
    proposeRecruitmentEventUpdate({
      userId: "user-a",
      input: { applicationId: "application-1", eventId: "event-1", patch: { deadlineAt: "2026-10-08T14:20" }, deriveDeadlineFromRelativeValidity: true },
      dependencies: deps.value
    }),
    (error) => code(error) === "AMBIGUOUS_DEADLINE_SOURCE"
  );
  assert.equal(deps.proposals.length, 0);
});

test("derive requires receivedAt and a valid relative validity", async () => {
  const missingReceivedAt = dependencies(event({ receivedAt: null }));
  await assert.rejects(
    proposeRecruitmentEventUpdate({
      userId: "user-a",
      input: { applicationId: "application-1", eventId: "event-1", deriveDeadlineFromRelativeValidity: true },
      dependencies: missingReceivedAt.value
    }),
    (error) => code(error) === "MISSING_RECEIVED_AT"
  );

  const missingValidity = dependencies(event({ relativeValidityMinutes: null }));
  await assert.rejects(
    proposeRecruitmentEventUpdate({
      userId: "user-a",
      input: { applicationId: "application-1", eventId: "event-1", deriveDeadlineFromRelativeValidity: true },
      dependencies: missingValidity.value
    }),
    (error) => code(error) === "INVALID_RELATIVE_VALIDITY"
  );
});

test("materializing only deadline preserves effectiveDueAt", async () => {
  const current = event();
  const deps = dependencies(current);
  await proposeRecruitmentEventUpdate({
    userId: "user-a",
    input: { applicationId: "application-1", eventId: "event-1", deriveDeadlineFromRelativeValidity: true },
    dependencies: deps.value
  });
  const patch = (deps.proposals[0] as { input: { payload: { patch: { deadlineAt: string } } } }).input.payload.patch;
  const before = resolveEventTime(current).effectiveDueAt;
  const after = resolveEventTime({ ...current, deadlineAt: new Date(`${patch.deadlineAt}Z`) }).effectiveDueAt;
  assert.equal(after?.getTime(), before?.getTime());
});

test("materialization is rejected when an earlier explicit deadline currently controls effective due time", async () => {
  const deps = dependencies(event({ deadlineAt: new Date("2026-10-05T14:20:00.000Z") }));
  await assert.rejects(
    proposeRecruitmentEventUpdate({
      userId: "user-a",
      input: { applicationId: "application-1", eventId: "event-1", deriveDeadlineFromRelativeValidity: true },
      dependencies: deps.value
    }),
    (error) => code(error) === "EFFECTIVE_DUE_CHANGED"
  );
});

test("no-change, wrong-application, and cross-user lookups create no Proposal", async () => {
  const noChange = dependencies();
  await assert.rejects(
    proposeRecruitmentEventUpdate({
      userId: "user-a",
      input: { applicationId: "application-1", eventId: "event-1", patch: { title: "在线测评" } },
      dependencies: noChange.value
    }),
    (error) => code(error) === "NO_CHANGES"
  );

  const mismatch = dependencies();
  await assert.rejects(
    proposeRecruitmentEventUpdate({
      userId: "user-a",
      input: { applicationId: "application-2", eventId: "event-1", patch: { title: "新标题" } },
      dependencies: mismatch.value
    }),
    (error) => code(error) === "APPLICATION_MISMATCH"
  );

  const unowned = dependencies(null);
  await assert.rejects(
    proposeRecruitmentEventUpdate({
      userId: "user-b",
      input: { applicationId: "application-1", eventId: "event-1", patch: { title: "新标题" } },
      dependencies: unowned.value
    }),
    (error) => code(error) === "NOT_FOUND"
  );
  assert.equal(noChange.proposals.length + mismatch.proposals.length + unowned.proposals.length, 0);
});
