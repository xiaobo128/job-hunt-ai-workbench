import assert from "node:assert/strict";
import test from "node:test";

import {
  matchRecruitmentEventToApplications,
  recruitmentEventSelectionCandidates
} from "./recruitment-event-matching.ts";

const candidates = [
  {
    applicationId: "technical-product-business-trainee",
    companyName: "腾讯",
    roleTitle: "技术产品商务培训生",
    city: "待确认"
  },
  {
    applicationId: "industry-consulting",
    companyName: "腾讯",
    roleTitle: "解决方案-行业咨询方向 技术岗位",
    city: "待确认"
  }
];

function extraction(companyHint, roleHint) {
  return {
    companyHint,
    roleHint,
    eventType: "WRITTEN_TEST",
    intent: "WRITTEN_TEST_INVITATION",
    schedule: { type: "UNKNOWN", startAt: null, endAt: null, rawText: null },
    deliveryMode: "UNKNOWN",
    onlineUrl: null,
    offlineAddress: null,
    actions: null,
    requirements: null,
    summary: null,
    evidenceText: "matching test"
  };
}

function uniqueHighMatch(companyHint, roleHint) {
  const matches = matchRecruitmentEventToApplications(extraction(companyHint, roleHint), candidates);
  return matches.filter((match) => match.confidence === "HIGH");
}

test("matches Tencent CSIG business trainee notification to the trainee application", () => {
  const matches = uniqueHighMatch("腾讯云与智慧产业事业群(CSIG)", "技术产品商务培训生");

  assert.equal(matches.length, 1);
  assert.equal(matches[0].applicationId, "technical-product-business-trainee");
});

test("normalizes a CSIG-prefixed business trainee role", () => {
  const matches = uniqueHighMatch("腾讯", "CSIG技术产品商务培训生");

  assert.equal(matches.length, 1);
  assert.equal(matches[0].applicationId, "technical-product-business-trainee");
});

test("matches the industry consulting role without selecting the trainee application", () => {
  const matches = uniqueHighMatch("腾讯", "解决方案-行业咨询方向 技术岗位");

  assert.equal(matches.length, 1);
  assert.equal(matches[0].applicationId, "industry-consulting");
});

test("preserves multiple HIGH candidates for the caller to reject as ambiguous", () => {
  const duplicateCandidates = [
    candidates[0],
    { ...candidates[0], applicationId: "duplicate-trainee" }
  ];
  const matches = matchRecruitmentEventToApplications(
    extraction("腾讯 CSIG", "腾讯云技术产品商务培训生"),
    duplicateCandidates
  );

  assert.deepEqual(
    matches.filter((match) => match.confidence === "HIGH").map((match) => match.applicationId).sort(),
    ["duplicate-trainee", "technical-product-business-trainee"]
  );
});

test("offers both Tencent applications for manual selection when the notification has no role", () => {
  const matches = matchRecruitmentEventToApplications(extraction("腾讯", null), candidates);
  const selectionCandidates = recruitmentEventSelectionCandidates(matches);

  assert.deepEqual(
    selectionCandidates.map(({ applicationId, confidence, score }) => ({ applicationId, confidence, score })),
    [
      { applicationId: "industry-consulting", confidence: "MEDIUM", score: 70 },
      { applicationId: "technical-product-business-trainee", confidence: "MEDIUM", score: 70 }
    ]
  );
});

test("manual selection candidates exclude LOW matches and are limited to three", () => {
  const matches = [
    ...Array.from({ length: 4 }, (_, index) => ({
      applicationId: `medium-${index}`,
      companyName: "腾讯",
      roleTitle: `岗位 ${index}`,
      score: 70 - index,
      confidence: "MEDIUM",
      reasons: ["公司名称完全匹配"]
    })),
    {
      applicationId: "low",
      companyName: "其他公司",
      roleTitle: "其他岗位",
      score: 30,
      confidence: "LOW",
      reasons: []
    }
  ];

  assert.deepEqual(
    recruitmentEventSelectionCandidates(matches).map((candidate) => candidate.applicationId),
    ["medium-0", "medium-1", "medium-2"]
  );
});
