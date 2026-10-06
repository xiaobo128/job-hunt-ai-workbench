import assert from "node:assert/strict";
import test from "node:test";
import { AgentProposalType, ApplicationStage } from "@prisma/client";
import type { RecruitmentEventExtraction } from "./ai";
import {
  createRecruitmentEventProposal,
  proposeRecruitmentEvent,
  RecruitmentEventProposalError
} from "./recruitment-event-proposals";

const extraction: RecruitmentEventExtraction = {
  companyHint: "Example Co",
  roleHint: "Product Manager",
  eventType: "ASSESSMENT",
  intent: "ASSESSMENT_INVITATION",
  schedule: {
    type: "DEADLINE",
    startAt: null,
    endAt: "2026-10-20T23:59:00+08:00",
    rawText: "2026-10-20 23:59"
  },
  deliveryMode: "ONLINE",
  deliveryModeRawText: "在线测评",
  onlineUrl: "https://assessment.example.com/start",
  offlineAddress: null,
  actions: ["请在截止时间前完成测评"],
  requirements: ["请准备身份证"],
  evidenceText: "Subject: 在线测评邀请\n\n请在截止时间前完成测评"
};

function proposalErrorCode(error: unknown) {
  assert.ok(error instanceof RecruitmentEventProposalError);
  return error.code;
}

test("assessment extraction creates only a pending APPLICATION_EVENT_APPEND proposal", async () => {
  const proposalWrites: unknown[] = [];
  const result = await createRecruitmentEventProposal({
    userId: "user-a",
    extraction,
    application: { applicationId: "application-1", companyName: "Example Co", roleTitle: "Product Manager" },
    subject: "在线测评邀请",
    receivedAt: "2026-10-06T09:00",
    content: "请在截止时间前完成测评"
  }, {
    createProposal: async (input) => {
      proposalWrites.push(input);
      return { id: "proposal-1", status: "PENDING" } as never;
    }
  });

  assert.deepEqual(result, {
    created: true,
    proposalId: "proposal-1",
    status: "PENDING",
    application: { applicationId: "application-1", companyName: "Example Co", roleTitle: "Product Manager" },
    eventType: "ASSESSMENT",
    title: "在线测评邀请"
  });
  assert.equal(proposalWrites.length, 1);
  const write = proposalWrites[0] as { input: { type: string; payload: Record<string, unknown> } };
  assert.equal(write.input.type, AgentProposalType.APPLICATION_EVENT_APPEND);
  assert.equal(write.input.payload.deadlineAt, "2026-10-20T23:59:00+08:00");
  assert.equal("requestedStage" in write.input.payload, false);
});

test("active owned application runs existing extraction then returns agent-facing proposal fields", async () => {
  let extractedContent = "";
  let proposalCreates = 0;
  const result = await proposeRecruitmentEvent({
    userId: "user-a",
    input: { applicationId: "application-1", subject: " 在线测评邀请 ", sender: " recruiter@example.com ", content: "邮件正文" },
    dependencies: {
      findOwnedApplication: async () => ({
        applicationId: "application-1",
        companyName: "Example Co",
        roleTitle: "Product Manager",
        currentStage: ApplicationStage.APPLIED,
        jobLeadStage: ApplicationStage.APPLIED,
        aiSettings: { provider: "openai", apiKey: "test-key" }
      }),
      extractEvent: async (input) => {
        extractedContent = input.content;
        assert.equal(input.subject, "在线测评邀请");
        assert.equal(input.sender, "recruiter@example.com");
        return { data: extraction };
      },
      createProposal: async () => {
        proposalCreates += 1;
        return {
          created: true,
          proposalId: "proposal-1",
          status: "PENDING",
          application: { applicationId: "application-1", companyName: "Example Co", roleTitle: "Product Manager" },
          eventType: "ASSESSMENT",
          title: "在线测评邀请"
        };
      }
    }
  });

  assert.equal(extractedContent, "邮件正文");
  assert.equal(proposalCreates, 1);
  assert.deepEqual(result, {
    proposalId: "proposal-1",
    status: "PENDING",
    applicationId: "application-1",
    companyName: "Example Co",
    roleTitle: "Product Manager",
    eventType: "ASSESSMENT",
    title: "在线测评邀请",
    schedule: extraction.schedule,
    intent: "ASSESSMENT_INVITATION",
    deliveryMode: "ONLINE",
    onlineUrl: "https://assessment.example.com/start",
    offlineAddress: null,
    actions: extraction.actions,
    requirements: extraction.requirements,
    confirmationRequired: true
  });
});

test("another user's application is rejected before extraction or proposal creation", async () => {
  let downstreamCalls = 0;
  await assert.rejects(
    proposeRecruitmentEvent({
      userId: "user-b",
      input: { applicationId: "application-1", content: "邮件正文" },
      dependencies: {
        findOwnedApplication: async () => null,
        extractEvent: async () => { downstreamCalls += 1; return { data: extraction }; },
        createProposal: async () => { downstreamCalls += 1; return { created: false, reason: "UNKNOWN_EVENT_TYPE" }; }
      }
    }),
    (error) => proposalErrorCode(error) === "NOT_FOUND"
  );
  assert.equal(downstreamCalls, 0);
});

for (const stage of [ApplicationStage.CLOSED, ApplicationStage.REJECTED]) {
  test(`${stage} application is rejected before extraction or proposal creation`, async () => {
    let downstreamCalls = 0;
    await assert.rejects(
      proposeRecruitmentEvent({
        userId: "user-a",
        input: { applicationId: "application-1", content: "邮件正文" },
        dependencies: {
          findOwnedApplication: async () => ({
            applicationId: "application-1",
            companyName: "Example Co",
            roleTitle: "Product Manager",
            currentStage: stage,
            jobLeadStage: stage,
            aiSettings: {}
          }),
          extractEvent: async () => { downstreamCalls += 1; return { data: extraction }; },
          createProposal: async () => { downstreamCalls += 1; return { created: false, reason: "UNKNOWN_EVENT_TYPE" }; }
        }
      }),
      (error) => proposalErrorCode(error) === "APPLICATION_CLOSED"
    );
    assert.equal(downstreamCalls, 0);
  });
}

test("blank content is rejected before ownership lookup", async () => {
  let lookups = 0;
  await assert.rejects(
    proposeRecruitmentEvent({
      userId: "user-a",
      input: { applicationId: "application-1", content: "   " },
      dependencies: {
        findOwnedApplication: async () => { lookups += 1; return null; },
        extractEvent: async () => ({ data: extraction }),
        createProposal: async () => ({ created: false, reason: "UNKNOWN_EVENT_TYPE" })
      }
    }),
    (error) => proposalErrorCode(error) === "CONTENT_REQUIRED"
  );
  assert.equal(lookups, 0);
});
