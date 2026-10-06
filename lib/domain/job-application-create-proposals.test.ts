import assert from "node:assert/strict";
import test from "node:test";
import { AgentProposalStatus, AgentProposalType, ApplicationStage, SourceType } from "@prisma/client";
import {
  AgentProposalError,
  assertProposalExecutable,
  executeConfirmedAgentProposalInTransaction,
  executeProposalMutation,
  jobApplicationCreateProposalPayloadSchema
} from "./agent-proposals";
import { createJobApplication } from "./applications";
import {
  JobApplicationCreateProposalError,
  proposeJobApplicationCreate
} from "./job-application-create-proposals";

const input = {
  job: {
    companyName: "华宝新能源",
    roleTitle: "营销管培生",
    city: "广东省深圳市",
    sourceType: SourceType.TEXT,
    sourceUrl: "https://jobs.example.com/J12332",
    responsibilities: ["负责市场项目"],
    requirements: ["本科及以上"],
    rawContent: "华宝新能源营销管培生 JD"
  },
  application: { requestedStage: ApplicationStage.APPLIED }
};

function proposalErrorCode(run: () => unknown) {
  try {
    run();
  } catch (error) {
    assert.ok(error instanceof AgentProposalError);
    return error.code;
  }
  throw new Error("Expected AgentProposalError");
}

test("proposal creation writes only one pending proposal input and no canonical records", async () => {
  const proposalWrites: unknown[] = [];
  let canonicalWrites = 0;
  const result = await proposeJobApplicationCreate({
    userId: "user-a",
    input,
    dependencies: {
      findExisting: async () => null,
      findPending: async () => [],
      createProposal: async (proposalInput) => {
        proposalWrites.push(proposalInput);
        return { id: "proposal-1", status: AgentProposalStatus.PENDING } as never;
      }
    }
  });

  assert.equal(canonicalWrites, 0);
  assert.equal(proposalWrites.length, 1);
  const proposal = proposalWrites[0] as { input: Record<string, unknown> };
  assert.equal(proposal.input.type, AgentProposalType.JOB_APPLICATION_CREATE);
  assert.equal("applicationId" in proposal.input, false);
  assert.deepEqual(result, {
    proposalId: "proposal-1",
    status: AgentProposalStatus.PENDING,
    companyName: "华宝新能源",
    roleTitle: "营销管培生",
    city: "广东省深圳市",
    requestedStage: ApplicationStage.APPLIED,
    confirmationRequired: true
  });
});

test("obvious duplicate records stop before proposal creation", async () => {
  let proposals = 0;
  await assert.rejects(proposeJobApplicationCreate({
    userId: "user-a",
    input,
    dependencies: {
      findExisting: async () => ({
        jobLeadId: "job-existing",
        applicationId: "application-existing",
        proposalId: null,
        companyName: "华宝新能源",
        roleTitle: "营销管培生",
        sourceUrl: "https://jobs.example.com/J12332"
      }),
      findPending: async () => [],
      createProposal: async () => { proposals += 1; return {} as never; }
    }
  }), (error) => error instanceof JobApplicationCreateProposalError && error.code === "DUPLICATE_APPLICATION");
  assert.equal(proposals, 0);
});

test("duplicate pending creation proposals are rejected deterministically", async () => {
  await assert.rejects(proposeJobApplicationCreate({
    userId: "user-a",
    input,
    dependencies: {
      findExisting: async () => null,
      findPending: async () => [{ id: "proposal-existing", payloadJson: JSON.stringify(input) }],
      createProposal: async () => ({} as never)
    }
  }), (error) => error instanceof JobApplicationCreateProposalError && error.duplicate.proposalId === "proposal-existing");
});

test("creation payload rejects missing identity fields, invalid stage or URL, and unknown fields", () => {
  assert.throws(() => jobApplicationCreateProposalPayloadSchema.parse({ ...input, job: { ...input.job, companyName: "" } }));
  assert.throws(() => jobApplicationCreateProposalPayloadSchema.parse({ ...input, job: { ...input.job, roleTitle: "" } }));
  assert.throws(() => jobApplicationCreateProposalPayloadSchema.parse({ ...input, application: { requestedStage: "INVALID" } }));
  assert.throws(() => jobApplicationCreateProposalPayloadSchema.parse({ ...input, job: { ...input.job, sourceUrl: "file:///tmp/jd" } }));
  assert.throws(() => jobApplicationCreateProposalPayloadSchema.parse({ ...input, unexpected: true }));
});

test("confirmed create proposals are owner-only, reject wrong attachment, rejection, and replay", () => {
  const confirmed = {
    userId: "user-a",
    applicationId: null,
    application: null,
    type: AgentProposalType.JOB_APPLICATION_CREATE,
    status: AgentProposalStatus.CONFIRMED as AgentProposalStatus
  };
  assert.doesNotThrow(() => assertProposalExecutable({ proposal: confirmed, userId: "user-a", expectedType: AgentProposalType.JOB_APPLICATION_CREATE }));
  assert.equal(proposalErrorCode(() => assertProposalExecutable({ proposal: confirmed, userId: "user-b" })), "NOT_FOUND");
  assert.equal(proposalErrorCode(() => assertProposalExecutable({ proposal: { ...confirmed, applicationId: "application-1", application: { jobLead: { ownerId: "user-a" } } }, userId: "user-a" })), "NOT_FOUND");
  assert.equal(proposalErrorCode(() => assertProposalExecutable({ proposal: { ...confirmed, status: AgentProposalStatus.REJECTED }, userId: "user-a" })), "REJECTED");
  assert.equal(proposalErrorCode(() => assertProposalExecutable({ proposal: { ...confirmed, status: AgentProposalStatus.EXECUTED }, userId: "user-a" })), "ALREADY_EXECUTED");
});

test("confirmed execution uses the creation domain service with the stored payload", async () => {
  const calls: unknown[] = [];
  const result = await executeProposalMutation({
    type: AgentProposalType.JOB_APPLICATION_CREATE,
    payloadJson: JSON.stringify(input),
    userId: "user-a",
    applicationId: null,
    transaction: {} as never,
    services: {
      createJobApplication: async (serviceInput: unknown) => {
        calls.push(serviceInput);
        return { jobLeadId: "job-1", application: { id: "application-1" } } as never;
      },
      updateApplicationStatus: async () => ({} as never),
      appendApplicationEvent: async () => ({} as never)
    }
  });
  assert.equal(calls.length, 1);
  assert.equal((calls[0] as { userId: string }).userId, "user-a");
  assert.deepEqual(result, {
    type: AgentProposalType.JOB_APPLICATION_CREATE,
    applicationId: "application-1",
    jobLeadId: "job-1",
    eventId: null
  });
});

test("confirmed transaction claims once before creating canonical records", async () => {
  let canonicalCreates = 0;
  let claims = 0;
  const proposal = {
    id: "proposal-1",
    userId: "user-a",
    applicationId: null,
    application: null,
    type: AgentProposalType.JOB_APPLICATION_CREATE,
    payloadJson: JSON.stringify(input),
    status: AgentProposalStatus.CONFIRMED
  };
  const transaction = {
    agentProposal: {
      findFirst: async () => proposal,
      updateMany: async () => { claims += 1; return { count: 1 }; }
    }
  };
  const result = await executeConfirmedAgentProposalInTransaction({
    userId: "user-a",
    proposalId: "proposal-1",
    expectedType: AgentProposalType.JOB_APPLICATION_CREATE,
    transaction: transaction as never,
    services: {
      createJobApplication: async () => {
        canonicalCreates += 1;
        return { jobLeadId: "job-1", application: { id: "application-1" } } as never;
      },
      updateApplicationStatus: async () => ({} as never),
      appendApplicationEvent: async () => ({} as never)
    }
  });
  assert.equal(claims, 1);
  assert.equal(canonicalCreates, 1);
  assert.equal(result.jobLeadId, "job-1");
});

test("failed claim, wrong owner, and rejected proposal never create canonical records", async () => {
  let canonicalCreates = 0;
  const services = {
    createJobApplication: async () => { canonicalCreates += 1; return {} as never; },
    updateApplicationStatus: async () => ({} as never),
    appendApplicationEvent: async () => ({} as never)
  };
  const base = {
    id: "proposal-1",
    userId: "user-a",
    applicationId: null,
    application: null,
    type: AgentProposalType.JOB_APPLICATION_CREATE,
    payloadJson: JSON.stringify(input),
    status: AgentProposalStatus.CONFIRMED as AgentProposalStatus
  };
  const run = (proposal: typeof base, claimCount: number, userId = "user-a") => executeConfirmedAgentProposalInTransaction({
    userId,
    proposalId: proposal.id,
    expectedType: AgentProposalType.JOB_APPLICATION_CREATE,
    transaction: {
      agentProposal: {
        findFirst: async () => proposal,
        updateMany: async () => ({ count: claimCount })
      }
    } as never,
    services
  });

  await assert.rejects(run(base, 0), (error) => error instanceof AgentProposalError && error.code === "ALREADY_EXECUTED");
  await assert.rejects(run(base, 1, "user-b"), (error) => error instanceof AgentProposalError && error.code === "NOT_FOUND");
  await assert.rejects(run({ ...base, status: AgentProposalStatus.REJECTED }, 1), (error) => error instanceof AgentProposalError && error.code === "REJECTED");
  assert.equal(canonicalCreates, 0);
});

test("canonical creation reuses stage sync and sets appliedAt only for APPLIED", async () => {
  const applied = await runCreate(ApplicationStage.APPLIED);
  assert.equal(applied.jobCreate.data.status, ApplicationStage.READY_TO_APPLY);
  assert.equal(applied.applicationUpdate.data.currentStage, ApplicationStage.APPLIED);
  assert.ok(applied.applicationUpdate.data.appliedAt instanceof Date);
  assert.deepEqual(applied.jobUpdate.data, { status: ApplicationStage.APPLIED });
  assert.equal(applied.jobCreate.data.needsReview, false);
  assert.ok(applied.jobCreate.data.reviewedAt instanceof Date);

  const ready = await runCreate(ApplicationStage.READY_TO_APPLY);
  assert.equal(ready.applicationUpdate.data.currentStage, ApplicationStage.READY_TO_APPLY);
  assert.equal(ready.applicationUpdate.data.appliedAt, undefined);
  assert.deepEqual(ready.jobUpdate.data, { status: ApplicationStage.READY_TO_APPLY });
});

async function runCreate(requestedStage: ApplicationStage) {
  let currentStage = ApplicationStage.READY_TO_APPLY;
  let jobCreate: any;
  let applicationUpdate: any;
  let jobUpdate: any;
  const tx = {
    jobLead: {
      create: async (value: any) => {
        jobCreate = value;
        return { id: "job-1", application: { id: "application-1" } };
      },
      update: async (value: any) => { jobUpdate = value; return { id: "job-1" }; }
    },
    application: {
      findFirst: async () => ({ id: "application-1", jobLeadId: "job-1", currentStage }),
      update: async (value: any) => {
        applicationUpdate = value;
        currentStage = value.data.currentStage;
        return { id: "application-1", ...value.data };
      }
    }
  };
  await createJobApplication({
    userId: "user-a",
    review: { needsReview: false },
    job: {
      companyName: "华宝新能源",
      roleTitle: "营销管培生",
      sourceType: SourceType.TEXT,
      skills: [], responsibilities: [], requirements: [], rawContent: "JD"
    },
    application: { requestedStage }
  }, tx as never);
  return { jobCreate, applicationUpdate, jobUpdate };
}
