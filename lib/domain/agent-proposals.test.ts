import assert from "node:assert/strict";
import test from "node:test";
import { AgentProposalStatus, AgentProposalType } from "@prisma/client";
import { AgentProposalError, applicationEventProposalPayloadSchema, applicationStatusProposalPayloadSchema, assertProposalExecutable, executeProposalMutation } from "./agent-proposals";
import { proposeApplicationStatusUpdate } from "./application-status-proposals";

const ownedConfirmed = {
  userId: "user-a",
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
      findOwnedApplication: async () => ({ id: "application-1", currentStage: "APPLIED" }),
      createProposal: async (input) => {
        created.push(input);
        return { id: "proposal-1", status: "PENDING" };
      }
    }
  });

  assert.deepEqual(result, { proposalId: "proposal-1", status: "PENDING", applicationId: "application-1", requestedStage: "FIRST_INTERVIEW" });
  assert.equal((created[0] as { input: { type: string } }).input.type, "APPLICATION_STATUS_UPDATE");
});

test("confirmed proposals are executable exactly for their owner and application owner", () => {
  assert.doesNotThrow(() => assertProposalExecutable({ proposal: ownedConfirmed, userId: "user-a", expectedType: AgentProposalType.APPLICATION_STATUS_UPDATE }));
  assert.equal(errorCode(() => assertProposalExecutable({ proposal: ownedConfirmed, userId: "user-b" })), "NOT_FOUND");
  assert.equal(errorCode(() => assertProposalExecutable({ proposal: { ...ownedConfirmed, application: { jobLead: { ownerId: "user-b" } } }, userId: "user-a" })), "NOT_FOUND");
});

test("executed proposals reject replay", () => {
  assert.equal(errorCode(() => assertProposalExecutable({ proposal: { ...ownedConfirmed, status: AgentProposalStatus.EXECUTED }, userId: "user-a" })), "ALREADY_EXECUTED");
});

test("proposal payloads are exact typed payloads and event payloads contain no stage mutation", () => {
  const status = applicationStatusProposalPayloadSchema.parse({ requestedStage: "INTERVIEW", note: "Recruiter confirmed." });
  assert.deepEqual(status, { requestedStage: "INTERVIEW", note: "Recruiter confirmed." });
  const event = applicationEventProposalPayloadSchema.parse({ eventType: "INTERVIEW", title: "First interview", detailsJson: '{"content":"Invite"}' });
  assert.equal("requestedStage" in event, false);
  assert.throws(() => applicationEventProposalPayloadSchema.parse({ ...event, requestedStage: "OFFER" }));
});

test("proposal execution reuses the domain services and event append cannot change stage", async () => {
  const calls: Array<{ service: string; input: Record<string, unknown> }> = [];
  const services = {
    updateApplicationStatus: async (input: Record<string, unknown>) => { calls.push({ service: "status", input }); return { id: "application-1" }; },
    appendApplicationEvent: async (input: Record<string, unknown>) => { calls.push({ service: "event", input }); return { id: "event-1" }; }
  };
  await executeProposalMutation({
    type: AgentProposalType.APPLICATION_STATUS_UPDATE,
    payloadJson: JSON.stringify({ requestedStage: "INTERVIEW" }),
    userId: "user-a", applicationId: "application-1", transaction: {} as never, services: services as never
  });
  await executeProposalMutation({
    type: AgentProposalType.APPLICATION_EVENT_APPEND,
    payloadJson: JSON.stringify({ eventType: "INTERVIEW", title: "Interview", detailsJson: "{}" }),
    userId: "user-a", applicationId: "application-1", transaction: {} as never, services: services as never
  });
  assert.equal(calls[0].service, "status");
  assert.equal(calls[0].input.requestedStage, "INTERVIEW");
  assert.equal(calls[1].service, "event");
  assert.equal("requestedStage" in calls[1].input, false);
});
