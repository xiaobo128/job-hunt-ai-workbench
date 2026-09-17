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
    usedResume: { id: string; title: string } | null;
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
    "# Target Job",
    "",
    `- 公司：${context.job.companyName ?? "未提供"}`,
    `- 岗位：${context.job.roleTitle ?? "未提供"}`,
    `- Base：${context.job.city ?? "未提供"}`,
    "",
    "## JD",
    "",
    "### 岗位职责",
    ...(context.job.responsibilities.length ? context.job.responsibilities.map((item) => `- ${item}`) : ["- 未提供"]),
    "",
    "### 岗位要求",
    ...(context.job.requirements.length ? context.job.requirements.map((item) => `- ${item}`) : ["- 未提供"]),
    "",
    "### 补充信息",
    `- 工作年限：${context.job.seniority ?? "未提供"}`,
    `- 薪资范围：${context.job.salaryRange ?? "未提供"}`,
    `- 技能：${context.job.skills.length ? context.job.skills.join("；") : "未提供"}`,
    `- 来源链接：${context.job.sourceUrl ?? "未提供"}`,
    "",
    "# Candidate Profile",
    ""
  ];
  if (!context.candidate) {
    lines.push("- 候选人事实缺失：没有可用的已确认 ResumeDocument。仅输出岗位、投递和通知上下文。");
  } else {
    lines.push(`- 简历版本：${context.candidate.resumeReference.title}`, "- 数据来源：已确认 ResumeDocument", "", "## 教育");
    appendEntries(lines, context.candidate.education);
    lines.push("", "## 实习 / 工作经历");
    appendEntries(lines, context.candidate.experience.filter((item) => item.kind === "internship" || item.kind === "work"));
    lines.push("", "## 项目经历");
    appendEntries(lines, context.candidate.experience.filter((item) => item.kind === "projectExperience"));
    lines.push("", "## 技能", ...(context.candidate.skills.length ? context.candidate.skills.map((skill) => `- ${skill}`) : ["- 未提供"]));
  }
  lines.push("", "# Application Context", "", `- 当前阶段：${context.application.stage ?? "未提供"}`, `- 投递日期：${context.application.appliedAt ?? "未提供"}`, `- 投递渠道：${context.application.submissionChannel ?? "未提供"}`, `- 下一步：${context.application.nextAction ?? "未提供"}`, `- 下一步日期：${context.application.nextActionDueAt ?? "未提供"}`, `- 备注：${context.application.note ?? "未提供"}`, `- 所用简历：${context.application.usedResume ? `${context.application.usedResume.title}（${context.application.usedResume.id}）` : "未关联，已回退到当前主简历"}`, "", "## Related Notifications", "");
  if (context.events.length === 0) lines.push("暂无相关通知");
  for (const event of context.events) {
    lines.push(`- 时间：${event.time ?? "未提供"}`, `  - 类型：${event.type}`, `  - 标题：${event.title}`);
    if (event.details.content) lines.push(`  - 已保存详情：${event.details.content}`);
    if (event.details.requirements.length) lines.push(`  - 已保存要求：${event.details.requirements.join("；")}`);
  }
  lines.push("", "# Task", "", "请基于以上信息分析：", "", "1. 岗位核心要求", "2. 候选人的主要匹配项", "3. 当前缺口与风险", "4. 简历修改建议", "5. 面试准备重点", "", "要求：", "", "- 只基于提供的候选人事实进行判断", "- 不要虚构候选人经历", "- 区分已确认事实与推断", "- 信息不足时明确指出");
  return lines.join("\n");
}

function appendEntries(lines: string[], entries: CandidateFacts["education"] | CandidateFacts["experience"]) {
  if (entries.length === 0) return lines.push("- 未提供");
  for (const item of entries) {
    lines.push(`- ${item.title} | ${item.organization ?? "未提供"} | ${item.period.start ?? "未提供"}—${item.period.end ?? "未提供"}`);
    if ("highSignalBullets" in item) for (const bullet of item.highSignalBullets) lines.push(`  - ${bullet}`);
  }
}
