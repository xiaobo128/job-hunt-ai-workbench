import assert from "node:assert/strict";
import test from "node:test";
import { candidateFactsFromConfirmedResume, createAgentHandoffInput } from "@/lib/agent-handoff";
import { buildAgentHandoff } from "@/lib/agent-handoff-client";

const source = {
  resumeId: "resume-1",
  resumeTitle: "已确认简历",
  confirmedParseId: "parse-1",
  documentJson: {
    schemaVersion: 1,
    basics: { name: "不应输出", phone: "13800000000", email: "candidate@example.test" },
    sections: [
      {
        id: "00000000-0000-4000-8000-000000000001",
        kind: "work",
        title: "工作经历",
        items: [{
          id: "00000000-0000-4000-8000-000000000002",
          heading: "产品经理",
          subheading: "示例公司",
          startDate: "2024-01",
          endDate: null,
          originalText: "不应输出",
          bullets: [{ id: "00000000-0000-4000-8000-000000000003", text: "负责核心功能上线" }]
        }]
      },
      {
        id: "00000000-0000-4000-8000-000000000004",
        kind: "skills",
        title: "技能",
        items: [{
          id: "00000000-0000-4000-8000-000000000005",
          heading: "技能",
          subheading: null,
          startDate: null,
          endDate: null,
          originalText: null,
          bullets: [{ id: "00000000-0000-4000-8000-000000000006", text: "TypeScript" }]
        }]
      }
    ]
  }
};

test("candidate facts are a minimal confirmed projection", () => {
  const result = candidateFactsFromConfirmedResume(source);
  assert.equal(result.candidate?.resumeReference.title, "已确认简历");
  assert.equal(result.candidate?.summary, null);
  assert.deepEqual(result.candidate?.skills, ["TypeScript"]);
  assert.deepEqual(result.candidate?.experience[0]?.highSignalBullets, ["负责核心功能上线"]);
  assert.doesNotMatch(JSON.stringify(result.candidate), /candidate@example\.test|13800000000|不应输出/);
});

test("handoff with no confirmed resume explicitly omits candidate facts and preserves missing fields", () => {
  const input = createAgentHandoffInput({
    job: { id: "job-1", companyName: "", roleTitle: "", city: null, seniority: null, salaryRange: null, skills: "not-json", responsibilities: "[]", requirements: "[]", sourceUrl: null },
    application: { id: "application-1", currentStage: "INTERVIEW", appliedAt: null, submissionChannel: null, nextAction: null, nextActionDueAt: null, note: null },
    events: [],
    candidateSource: null
  });
  const handoff = buildAgentHandoff(input, "interview");
  assert.equal(handoff.context.candidate, null);
  assert.equal(handoff.context.job.companyName, null);
  assert.match(handoff.prompt, /只能把 context 中的内容当作事实/);
  assert.match(handoff.markdown, /没有可用的已确认结构化简历解析/);
});
