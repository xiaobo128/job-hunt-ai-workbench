export const agentHandoffTasks = [
  { value: "assessment", label: "准备笔试" },
  { value: "interview", label: "准备面试" },
  { value: "project-deep-dive", label: "深挖项目" },
  { value: "job-match", label: "分析岗位匹配" },
  { value: "interview-retro", label: "面试复盘" }
] as const;

export type AgentHandoffTask = (typeof agentHandoffTasks)[number]["value"];

export type CandidateFacts = {
  resumeReference: { resumeId: string; title: string; confirmedParseId: string };
  summary: null;
  skills: string[];
  experience: Array<{
    kind: "internship" | "work" | "projectExperience";
    title: string;
    organization: string | null;
    period: { start: string | null; end: string | null };
    highSignalBullets: string[];
  }>;
  education: Array<{
    title: string;
    organization: string | null;
    period: { start: string | null; end: string | null };
  }>;
  certifications: string[];
  languages: string[];
};

export type AgentHandoffContext = {
  version: "agent-handoff-v1";
  dataQuality: { warnings: string[] };
  job: {
    id: string;
    companyName: string | null;
    roleTitle: string | null;
    city: string | null;
    seniority: string | null;
    salaryRange: string | null;
    skills: string[];
    responsibilities: string[];
    requirements: string[];
    sourceUrl: string | null;
  };
  application: {
    id: string;
    stage: string | null;
    appliedAt: string | null;
    submissionChannel: string | null;
    nextAction: string | null;
    nextActionDueAt: string | null;
    note: string | null;
  };
  events: Array<{
    type: string;
    title: string;
    time: string | null;
    details: { content: string | null; requirements: string[] };
  }>;
  candidate: CandidateFacts | null;
  localProjectPathHint: null;
};

export type AgentHandoffInput = Omit<AgentHandoffContext, "version" | "dataQuality" | "localProjectPathHint"> & {
  warnings: string[];
};

export type AgentHandoffBundle = {
  context: AgentHandoffContext;
  markdown: string;
  json: string;
  prompt: string;
};

export function buildAgentHandoff(input: AgentHandoffInput, task: AgentHandoffTask): AgentHandoffBundle {
  const context: AgentHandoffContext = {
    version: "agent-handoff-v1",
    dataQuality: { warnings: input.warnings },
    job: input.job,
    application: input.application,
    events: input.events,
    candidate: input.candidate,
    localProjectPathHint: null
  };
  const json = JSON.stringify(context, null, 2);
  const markdown = toMarkdown(context);
  const taskLabel = agentHandoffTasks.find((item) => item.value === task)?.label ?? task;
  const prompt = [
    `请基于以下 Agent Handoff context 完成「${taskLabel}」。`,
    "事实边界：只能把 context 中的内容当作事实；不得补全、猜测或把常识当作候选人、岗位或流程事实。",
    "对所有 null、空数组和 dataQuality.warnings 明确说明缺失；只在完成任务必要时提出最少数量的澄清问题。",
    "如需本地项目资料，请先询问用户提供平台中立的项目路径或相关文件；不要假设操作系统、WSL、Windows 或工作区路径。",
    "输出应可直接用于用户下一步准备，不执行外部操作、不调用工具。",
    "\n```json",
    json,
    "```"
  ].join("\n");

  return { context, json, markdown, prompt };
}

function toMarkdown(context: AgentHandoffContext) {
  const lines = [
    "# Agent Handoff v1",
    "",
    "## 岗位",
    `- 公司：${context.job.companyName ?? "未提供"}`,
    `- 岗位：${context.job.roleTitle ?? "未提供"}`,
    `- 城市：${context.job.city ?? "未提供"}`,
    `- 岗位要求：${context.job.requirements.length ? context.job.requirements.join("；") : "未提供"}`,
    "",
    "## 申请",
    `- 阶段：${context.application.stage ?? "未提供"}`,
    `- 下一步：${context.application.nextAction ?? "未提供"}`,
    "",
    "## 候选人"
  ];
  if (!context.candidate) {
    lines.push("- 未输出候选人事实：没有可用的已确认结构化简历解析。");
  } else {
    lines.push(`- 简历引用：${context.candidate.resumeReference.title}`);
    lines.push(`- Summary：${context.candidate.summary ?? "未提供"}`);
    lines.push(`- Skills：${context.candidate.skills.length ? context.candidate.skills.join("；") : "未提供"}`);
    for (const item of context.candidate.experience) {
      lines.push(`- ${item.kind}：${item.title} | ${item.organization ?? "未提供"} | ${item.period.start ?? "未提供"}—${item.period.end ?? "未提供"}`);
      for (const bullet of item.highSignalBullets) lines.push(`  - ${bullet}`);
    }
  }
  lines.push("", "## Events");
  if (context.events.length === 0) lines.push("- 未提供");
  for (const event of context.events) lines.push(`- ${event.type} | ${event.time ?? "未提供"} | ${event.title}`);
  lines.push("", "## Data quality warnings");
  for (const warning of context.dataQuality.warnings) lines.push(`- ${warning}`);
  return lines.join("\n");
}
