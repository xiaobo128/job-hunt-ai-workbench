import assert from "node:assert/strict";
import test from "node:test";
import { AgentProposalStatus, AgentProposalType } from "@prisma/client";
import { AgentProposalError, applicationEventProposalPayloadSchema, applicationEventUpdateProposalPayloadSchema, applicationStatusProposalPayloadSchema, assertProposalExecutable, executeProposalMutation, ownedProposalWhere } from "./agent-proposals";
import { proposeApplicationStatusUpdate } from "./application-status-proposals";
import { buildProposalConfirmationUrl, createConfirmableProposal, requireProposalConfirmationAppUrl } from "../proposal-confirmation-url";
import { updateApplicationStatus } from "./applications";

const ownedConfirmed = {
  userId: "user-a",
  applicationId: "application-1",
  application: { jobLead: { ownerId: "user-a" } },
  type: AgentProposalType.APPLICATION_STATUS_UPDATE,
  status: AgentProposalStatus.CONFIRMED
};

function errorCode(run: () => unknown) {
  try {
    run();
  } catch (error) {
    assert.ok(error instanceof AgentProposalError);
    return error.code;
  }
  throw new Error("Expected AgentProposalError");
}

test("unconfirmed proposals cannot execute", () => {
  assert.equal(errorCode(() => assertProposalExecutable({ proposal: { ...ownedConfirmed, status: AgentProposalStatus.PENDING }, userId: "user-a" })), "NOT_CONFIRMED");
});

test("agent creates an application status proposal without executing it", async () => {
  const created: unknown[] = [];
  const result = await proposeApplicationStatusUpdate({
    userId: "user-a",
    input: { applicationId: "application-1", requestedStage: "FIRST_INTERVIEW", nextAction: "准备一面" },
    dependencies: {
      findOwnedApplication: async () => ({ id: "application-1", currentStage: "APPLIED", jobLead: { companyName: "Tencent", roleTitle: "Solutions Consultant" } }),
      createProposal: async (input) => {
        created.push(input);
        return { id: "proposal-1", status: "PENDING" };
      }
    }
  });

  assert.deepEqual(result, { proposalId: "proposal-1", status: "PENDING", applicationId: "application-1", companyName: "Tencent", roleTitle: "Solutions Consultant", currentStage: "APPLIED", requestedStage: "FIRST_INTERVIEW", confirmationRequired: true });
  assert.equal((created[0] as { input: { type: string } }).input.type, "APPLICATION_STATUS_UPDATE");
});

test("proposal confirmation URLs are absolute and point to one encoded proposal", () => {
  assert.equal(buildProposalConfirmationUrl("https://workbench.example.com/", "proposal/with spaces"), "https://workbench.example.com/proposals/proposal%2Fwith%20spaces");
});

test("proposal creation configuration rejects missing or non-HTTP APP_URL", () => {
  assert.throws(() => requireProposalConfirmationAppUrl(null), /APP_URL_REQUIRED/);
  assert.throws(() => requireProposalConfirmationAppUrl("file:///tmp/workbench"), /APP_URL_INVALID/);
  assert.equal(requireProposalConfirmationAppUrl("https://workbench.example.com"), "https://workbench.example.com");
});

test("missing APP_URL prevents proposal creation", async () => {
  let created = 0;
  await assert.rejects(createConfirmableProposal({
    appUrl: null,
    createProposal: async () => {
      created += 1;
      return { proposalId: "proposal-1" };
    }
  }), /APP_URL_REQUIRED/);
  assert.equal(created, 0);
});

test("proposal detail lookup scopes both proposal and application ownership", () => {
  assert.deepEqual(ownedProposalWhere({ userId: "user-a", proposalId: "proposal-1" }), {
    id: "proposal-1",
    userId: "user-a",
    OR: [
      { type: "JOB_APPLICATION_CREATE", applicationId: null },
      {
        type: { in: ["APPLICATION_STATUS_UPDATE", "APPLICATION_EVENT_APPEND", "APPLICATION_EVENT_UPDATE"] },
        applicationId: { not: null },
        application: { jobLead: { ownerId: "user-a" } }
      }
    ]
  });
});

test("confirmed proposals are executable exactly for their owner and application owner", () => {
  assert.doesNotThrow(() => assertProposalExecutable({ proposal: ownedConfirmed, userId: "user-a", expectedType: AgentProposalType.APPLICATION_STATUS_UPDATE }));
  assert.equal(errorCode(() => assertProposalExecutable({ proposal: ownedConfirmed, userId: "user-b" })), "NOT_FOUND");
  assert.equal(errorCode(() => assertProposalExecutable({ proposal: { ...ownedConfirmed, application: { jobLead: { ownerId: "user-b" } } }, userId: "user-a" })), "NOT_FOUND");
});

test("executed proposals reject replay", () => {
  assert.equal(errorCode(() => assertProposalExecutable({ proposal: { ...ownedConfirmed, status: AgentProposalStatus.EXECUTED }, userId: "user-a" })), "ALREADY_EXECUTED");
});

test("existing proposal types still require an owned application after applicationId becomes nullable", () => {
  assert.equal(errorCode(() => assertProposalExecutable({ proposal: { ...ownedConfirmed, applicationId: null, application: null }, userId: "user-a" })), "NOT_FOUND");
});

test("proposal payloads are exact typed payloads and event payloads contain no stage mutation", () => {
  const status = applicationStatusProposalPayloadSchema.parse({ requestedStage: "AI_INTERVIEW", note: "Recruiter confirmed." });
  assert.deepEqual(status, { requestedStage: "AI_INTERVIEW", note: "Recruiter confirmed." });
  const event = applicationEventProposalPayloadSchema.parse({ eventType: "INTERVIEW", title: "First interview", detailsJson: '{"content":"Invite"}' });
  assert.equal("requestedStage" in event, false);
  assert.throws(() => applicationEventProposalPayloadSchema.parse({ ...event, requestedStage: "OFFER" }));
});

test("event update payload is strict, non-empty, and cannot reassign an Application or change stage", () => {
  const payload = applicationEventUpdateProposalPayloadSchema.parse({
    eventId: "event-1",
    patch: { deadlineAt: "2026-10-08T14:20" }
  });
  assert.deepEqual(payload, { eventId: "event-1", patch: { deadlineAt: "2026-10-08T14:20" } });
  assert.throws(() => applicationEventUpdateProposalPayloadSchema.parse({ eventId: "event-1", patch: {} }));
  assert.throws(() => applicationEventUpdateProposalPayloadSchema.parse({ eventId: "event-1", patch: { applicationId: "application-2" } }));
  assert.throws(() => applicationEventUpdateProposalPayloadSchema.parse({ eventId: "event-1", patch: { targetApplicationId: "application-2" } }));
  assert.throws(() => applicationEventUpdateProposalPayloadSchema.parse({ eventId: "event-1", patch: { requestedStage: "OFFER" } }));
  assert.throws(() => applicationEventUpdateProposalPayloadSchema.parse({ eventId: "event-1", patch: { deadlineAt: "not-a-date" } }));
  assert.throws(() => applicationEventUpdateProposalPayloadSchema.parse({ eventId: "event-1", patch: { title: "updated" }, unknown: true }));
});

test("proposal execution reuses the domain services and event append cannot change stage", async () => {
  const calls: Array<{ service: string; input: Record<string, unknown> }> = [];
  const services = {
    updateApplicationStatus: async (input: Record<string, unknown>) => { calls.push({ service: "status", input }); return { id: "application-1" }; },
    appendApplicationEvent: async (input: Record<string, unknown>) => { calls.push({ service: "event", input }); return { id: "event-1" }; }
  };
  await executeProposalMutation({
    type: AgentProposalType.APPLICATION_STATUS_UPDATE,
    payloadJson: JSON.stringify({ requestedStage: "AI_INTERVIEW" }),
    userId: "user-a", applicationId: "application-1", transaction: {} as never, services: services as never
  });
  await executeProposalMutation({
    type: AgentProposalType.APPLICATION_EVENT_APPEND,
    payloadJson: JSON.stringify({ eventType: "INTERVIEW", title: "Interview", detailsJson: "{}" }),
    userId: "user-a", applicationId: "application-1", transaction: {} as never, services: services as never
  });
  assert.equal(calls[0].service, "status");
  assert.equal(calls[0].input.requestedStage, "AI_INTERVIEW");
  assert.equal(calls[1].service, "event");
  assert.equal("requestedStage" in calls[1].input, false);
});

test("event update execution uses the stored patch and returns the same Event id", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const result = await executeProposalMutation({
    type: AgentProposalType.APPLICATION_EVENT_UPDATE,
    payloadJson: JSON.stringify({ eventId: "event-1", patch: { deadlineAt: "2026-10-08T14:20:00" } }),
    userId: "user-a",
    applicationId: "application-1",
    transaction: {} as never,
    services: {
      updateApplicationEvent: async (input: Record<string, unknown>) => {
        calls.push(input);
        return { event: { id: "event-1", applicationId: "application-1" }, jobLeadId: "job-1" } as never;
      }
    }
  });

  assert.equal(result.eventId, "event-1");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].expectedApplicationId, "application-1");
  assert.equal("targetApplicationId" in calls[0], false);
  assert.equal("requestedStage" in calls[0], false);
  assert.equal(((calls[0].patch as Record<string, unknown>).deadlineAt as Date).toISOString(), "2026-10-08T14:20:00.000Z");
});

test("rejected and replayed event update proposals cannot execute", () => {
  const updateProposal = { ...ownedConfirmed, type: AgentProposalType.APPLICATION_EVENT_UPDATE };
  assert.equal(errorCode(() => assertProposalExecutable({ proposal: { ...updateProposal, status: AgentProposalStatus.REJECTED }, userId: "user-a" })), "REJECTED");
  assert.equal(errorCode(() => assertProposalExecutable({ proposal: { ...updateProposal, status: AgentProposalStatus.EXECUTED }, userId: "user-a" })), "ALREADY_EXECUTED");
});

test("the canonical status service updates the application and keeps the job lead stage in sync", async () => {
  const writes: Array<{ model: string; input: unknown }> = [];
  const transaction = {
    application: {
      findFirst: async () => ({ id: "application-1", jobLeadId: "job-1", currentStage: "READY_TO_APPLY" }),
      update: async (input: unknown) => {
        writes.push({ model: "application", input });
        return { id: "application-1" };
      }
    },
    jobLead: {
      update: async (input: unknown) => {
        writes.push({ model: "jobLead", input });
        return { id: "job-1" };
      }
    }
  };

  await updateApplicationStatus({
    userId: "user-a",
    applicationId: "application-1",
    requestedStage: "CLOSED",
    note: "Position closed"
  }, transaction as never);

  assert.equal(writes.length, 2);
  assert.deepEqual(writes[0], {
    model: "application",
    input: { where: { id: "application-1" }, data: { currentStage: "CLOSED", note: "Position closed", appliedAt: undefined } }
  });
  assert.deepEqual(writes[1], {
    model: "jobLead",
    input: { where: { id: "job-1" }, data: { status: "CLOSED" } }
  });
});
