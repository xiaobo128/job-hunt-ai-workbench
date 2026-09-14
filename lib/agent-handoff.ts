import { ResumeDocumentSchema } from "@/lib/resume-parsing/core";
import type { AgentHandoffInput, CandidateFacts } from "@/lib/agent-handoff-client";

type ResumeFactSource = {
  resumeId: string;
  resumeTitle: string;
  confirmedParseId: string;
  documentJson: unknown;
};


function text(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized || null;
}

function parseList(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && Boolean(text(item))) : [];
  } catch {
    return [];
  }
}

function parseEventDetails(value: string) {
  try {
    const parsed = JSON.parse(value) as { content?: unknown; requirements?: unknown };
    return {
      content: typeof parsed.content === "string" ? text(parsed.content) : null,
      requirements: Array.isArray(parsed.requirements)
        ? parsed.requirements.filter((item): item is string => typeof item === "string" && Boolean(text(item)))
        : []
    };
  } catch {
    return { content: null, requirements: [] };
  }
}

export function candidateFactsFromConfirmedResume(source: ResumeFactSource | null): { candidate: CandidateFacts | null; warnings: string[] } {
  if (!source) {
    return { candidate: null, warnings: ["未找到与该岗位关联的、已确认的结构化简历解析；未输出候选人事实。"] };
  }

  const parsed = ResumeDocumentSchema.safeParse(source.documentJson);
  if (!parsed.success) {
    return { candidate: null, warnings: ["已确认简历的结构化内容无效；未输出候选人事实。"] };
  }

  const skills = parsed.data.sections
    .filter((section) => section.kind === "skills")
    .flatMap((section) => section.items.flatMap((item) => item.bullets.map((bullet) => text(bullet.text)).filter((bullet): bullet is string => Boolean(bullet))));
  const experience = parsed.data.sections
    .filter((section) => section.kind === "internship" || section.kind === "work" || section.kind === "projectExperience")
    .flatMap((section) => section.items.map((item) => ({
      kind: section.kind as "internship" | "work" | "projectExperience",
      title: item.heading,
      organization: text(item.subheading),
      period: { start: text(item.startDate), end: text(item.endDate) },
      highSignalBullets: item.bullets.map((bullet) => text(bullet.text)).filter((bullet): bullet is string => Boolean(bullet))
    })));
  const education = parsed.data.sections
    .filter((section) => section.kind === "education")
    .flatMap((section) => section.items.map((item) => ({
      title: item.heading,
      organization: text(item.subheading),
      period: { start: text(item.startDate), end: text(item.endDate) }
    })));

  const warnings: string[] = [
    "已确认简历 schema 未提供 summary；summary 明确为 null。",
    "已确认简历 schema 未提供独立 certifications 字段；certifications 明确为空数组。",
    "已确认简历 schema 未提供独立 languages 字段；languages 明确为空数组。"
  ];
  if (skills.length === 0) warnings.push("已确认简历中没有可用的 skills 条目。");
  if (experience.length === 0) warnings.push("已确认简历中没有可用的经历或项目条目。");
  if (education.length === 0) warnings.push("已确认简历中没有教育经历。");
  if (experience.some((item) => !item.organization)) warnings.push("部分经历或项目没有确认的组织信息；对应 organization 为 null。");
  if (experience.some((item) => !item.period.start || !item.period.end)) warnings.push("部分经历或项目没有完整确认的起止时间；对应 period 字段为 null。");
  if (experience.some((item) => item.highSignalBullets.length === 0)) warnings.push("部分经历或项目没有确认的高信号 bullet。");

  return {
    candidate: {
      resumeReference: { resumeId: source.resumeId, title: source.resumeTitle, confirmedParseId: source.confirmedParseId },
      summary: null,
      skills,
      experience,
      education,
      certifications: [],
      languages: []
    },
    warnings
  };
}

function collectWarnings(input: Omit<AgentHandoffInput, "warnings">) {
  const warnings: string[] = [];
  const missing = (value: string | null | string[], label: string) => {
    if (value === null || (Array.isArray(value) && value.length === 0)) warnings.push(`${label}缺失或为空。`);
  };
  missing(input.job.companyName, "岗位公司名称");
  missing(input.job.roleTitle, "岗位名称");
  missing(input.job.city, "岗位城市");
  missing(input.job.seniority, "岗位工作年限");
  missing(input.job.salaryRange, "岗位薪资范围");
  missing(input.job.skills, "岗位技能");
  missing(input.job.responsibilities, "岗位职责");
  missing(input.job.requirements, "岗位要求");
  missing(input.job.sourceUrl, "岗位来源链接");
  missing(input.application.stage, "申请阶段");
  missing(input.application.appliedAt, "申请时间");
  missing(input.application.submissionChannel, "投递渠道");
  missing(input.application.nextAction, "下一步动作");
  missing(input.application.nextActionDueAt, "下一步截止时间");
  missing(input.application.note, "申请备注");
  if (input.events.length === 0) warnings.push("没有已保存的申请事件。");
  if (input.events.some((event) => !event.time)) warnings.push("部分申请事件没有确认时间；对应 time 为 null。");
  if (input.events.some((event) => !event.details.content && event.details.requirements.length === 0)) {
    warnings.push("部分申请事件没有可用的已保存详情；对应 details.content 为 null 且 requirements 为空数组。");
  }

  return warnings;
}

export function createAgentHandoffInput(args: {
  job: {
    id: string; companyName: string; roleTitle: string; city: string | null; seniority: string | null; salaryRange: string | null;
    skills: string; responsibilities: string; requirements: string; sourceUrl: string | null;
  };
  application: {
    id: string; currentStage: string; appliedAt: Date | null; submissionChannel: string | null; nextAction: string | null; nextActionDueAt: Date | null; note: string | null;
  };
  events: Array<{ id: string; eventType: string; title: string; eventTime: Date | null; createdAt: Date; detailsJson: string }>;
  candidateSource: ResumeFactSource | null;
}): AgentHandoffInput {
  const candidateResult = candidateFactsFromConfirmedResume(args.candidateSource);
  const input = {
    job: {
      id: args.job.id, companyName: text(args.job.companyName), roleTitle: text(args.job.roleTitle), city: text(args.job.city), seniority: text(args.job.seniority), salaryRange: text(args.job.salaryRange),
      skills: parseList(args.job.skills), responsibilities: parseList(args.job.responsibilities), requirements: parseList(args.job.requirements), sourceUrl: text(args.job.sourceUrl)
    },
    application: {
      id: args.application.id, stage: text(args.application.currentStage), appliedAt: args.application.appliedAt?.toISOString() ?? null,
      submissionChannel: text(args.application.submissionChannel), nextAction: text(args.application.nextAction), nextActionDueAt: args.application.nextActionDueAt?.toISOString() ?? null, note: text(args.application.note)
    },
    events: [...args.events]
      .sort((left, right) => {
        const leftTime = (left.eventTime ?? left.createdAt).getTime();
        const rightTime = (right.eventTime ?? right.createdAt).getTime();
        return leftTime - rightTime || left.id.localeCompare(right.id);
      })
      .map((event) => ({ type: event.eventType, title: event.title, time: event.eventTime?.toISOString() ?? null, details: parseEventDetails(event.detailsJson) })),
    candidate: candidateResult.candidate
  };
  return { ...input, warnings: [...candidateResult.warnings, ...collectWarnings(input)] };
}
