import assert from "node:assert/strict";
import test from "node:test";
import { AgentProposalStatus, AgentProposalType } from "@prisma/client";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProposalCard, type ProposalCardData } from "./proposal-card";

const pendingProposal: ProposalCardData = {
  id: "proposal-1",
  type: AgentProposalType.APPLICATION_STATUS_UPDATE,
  payloadJson: JSON.stringify({ requestedStage: "CLOSED", nextAction: "Archive documents", note: "Role closed" }),
  sourceType: "AGENT_STATUS_UPDATE",
  sourceIdentifier: null,
  evidenceText: "Agent suggested changing application application-1 from READY_TO_APPLY to CLOSED.",
  status: AgentProposalStatus.PENDING,
  createdAt: new Date("2026-10-06T00:00:00.000Z"),
  application: {
    currentStage: "READY_TO_APPLY",
    jobLead: { companyName: "Tencent", roleTitle: "Solutions Consultant" }
  }
};

test("pending status proposal renders its details and confirmation actions", () => {
  const markup = renderToStaticMarkup(<ProposalCard proposal={pendingProposal} />);
  assert.match(markup, /Tencent/);
  assert.match(markup, /Solutions Consultant/);
  assert.match(markup, /待投递 → 已结束/);
  assert.match(markup, /Archive documents/);
  assert.match(markup, /Role closed/);
  assert.match(markup, /AGENT_STATUS_UPDATE/);
  assert.match(markup, /确认并执行/);
  assert.match(markup, /拒绝/);
});

test("executed status proposal is read-only when reopened", () => {
  const markup = renderToStaticMarkup(<ProposalCard proposal={{ ...pendingProposal, status: AgentProposalStatus.EXECUTED }} />);
  assert.match(markup, /该变更已经执行，不能再次执行/);
  assert.doesNotMatch(markup, /确认并执行/);
  assert.doesNotMatch(markup, />拒绝</);
});

test("rejected status proposal is read-only", () => {
  const markup = renderToStaticMarkup(<ProposalCard proposal={{ ...pendingProposal, status: AgentProposalStatus.REJECTED }} />);
  assert.match(markup, /该建议已被拒绝，未修改申请/);
  assert.doesNotMatch(markup, /确认并执行/);
});
