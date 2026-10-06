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

test("pending recruitment event proposal renders user-facing event details and immediate execution action", () => {
  const proposal: ProposalCardData = {
    ...pendingProposal,
    type: AgentProposalType.APPLICATION_EVENT_APPEND,
    sourceType: "RECRUITMENT_EMAIL",
    evidenceText: "Subject: 在线测评邀请\nSender: recruiter@example.com\nReceived-At: 2026-10-06T09:00\n\n请于 2026-10-20 前完成测评。",
    payloadJson: JSON.stringify({
      eventType: "ASSESSMENT",
      title: "在线测评邀请",
      deadlineAt: "2026-10-20T23:59:00+08:00",
      detailsJson: JSON.stringify({
        content: "请于 2026-10-20 前完成测评。",
        requirements: ["请准备身份证"],
        extraction: {
          schedule: { type: "DEADLINE", startAt: null, endAt: "2026-10-20T23:59:00+08:00", rawText: "2026-10-20" },
          deliveryMode: "ONLINE",
          onlineUrl: "https://assessment.example.com/start",
          offlineAddress: null,
          actions: ["请于 2026-10-20 前完成测评"]
        }
      })
    })
  };

  const markup = renderToStaticMarkup(<ProposalCard proposal={proposal} />);
  assert.match(markup, /新增通知/);
  assert.match(markup, /在线测评邀请/);
  assert.match(markup, /测评/);
  assert.match(markup, /确认并执行/);
  assert.match(markup, /查看通知原文/);
  assert.doesNotMatch(markup, /APPLICATION_EVENT_APPEND/);
});

test("pending job creation proposal renders reviewable facts without implementation jargon", () => {
  const proposal: ProposalCardData = {
    ...pendingProposal,
    type: AgentProposalType.JOB_APPLICATION_CREATE,
    application: null,
    sourceType: "AGENT_JOB_APPLICATION_CREATE",
    evidenceText: "Agent proposed creating a job application.",
    payloadJson: JSON.stringify({
      job: {
        companyName: "华宝新能源",
        roleTitle: "营销管培生（J12332）",
        city: "广东省深圳市",
        sourceType: "TEXT",
        sourceUrl: "https://jobs.example.com/J12332",
        responsibilities: ["负责市场项目"],
        requirements: ["本科及以上"],
        rawContent: "华宝新能源营销管培生岗位原始 JD"
      },
      application: { requestedStage: "APPLIED", submissionChannel: "官网" }
    })
  };

  const markup = renderToStaticMarkup(<ProposalCard proposal={proposal} />);
  assert.match(markup, /新增求职记录/);
  assert.match(markup, /华宝新能源/);
  assert.match(markup, /营销管培生（J12332）/);
  assert.match(markup, /广东省深圳市/);
  assert.match(markup, /已投递/);
  assert.match(markup, /确认创建时自动记录/);
  assert.match(markup, /负责市场项目/);
  assert.match(markup, /本科及以上/);
  assert.match(markup, /岗位原始 JD/);
  assert.match(markup, /确认并创建/);
  assert.doesNotMatch(markup, /JOB_APPLICATION_CREATE|payloadJson|MCP|PENDING|AGENT_JOB_APPLICATION_CREATE/);
});
