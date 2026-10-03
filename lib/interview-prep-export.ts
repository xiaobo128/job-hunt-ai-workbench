import type { ApplicationStage, EventStatus } from "@prisma/client";
import { getStageDisplayLabel } from "@/lib/constants";
import { getEventTypeLabel } from "@/lib/event-types";
import type { ResumeDocument } from "@/lib/resume-parsing/core";
import { formatResumeDocument } from "@/lib/resume-analysis";
import { formatWallClockDate, formatWallClockDateTime } from "@/lib/wall-clock";

type ExportEvent = {
  id: string;
  eventType: string;
  status: EventStatus;
  title: string;
  eventTime: Date | null;
  windowStartAt: Date | null;
  deadlineAt: Date | null;
  createdAt: Date;
  detailsJson: string;
};

export type InterviewPrepApplication = {
  id: string;
  currentStage: ApplicationStage;
  appliedAt: Date | null;
  nextAction: string | null;
  note: string | null;
  updatedAt: Date;
  usedResume: {
    id: string;
    title: string;
    isPrimary: boolean;
  } | null;
  events: ExportEvent[];
  jobLead: {
    companyName: string;
    roleTitle: string;
    city: string | null;
    industry: string | null;
    sourceName: string | null;
    sourceUrl: string | null;
    responsibilities: string;
    requirements: string;
    rawContent: string;
  };
};

export type ConfirmedResumeById = ReadonlyMap<string, ResumeDocument>;

export function buildInterviewPrepMarkdown(
  applications: InterviewPrepApplication[],
  confirmedResumes: ConfirmedResumeById,
  generatedAt: Date
) {
  const lines = [
    "# 面试准备上下文",
    "",
    "用途：",
    "用于 AI 批量分析当前正在推进的岗位、岗位要求、所用简历和招聘事件。",
    "",
    "生成时间：",
    formatDateTime(generatedAt),
    "",
    "岗位数量：",
    String(applications.length)
  ];

  applications.forEach((application, index) => {
    const job = application.jobLead;
    lines.push(
      "",
      "---",
      "",
      `# 岗位 ${String(index + 1).padStart(2, "0")}｜${job.companyName} · ${job.roleTitle}`,
      "",
      "## 基本信息",
      "",
      `- 公司：${field(job.companyName)}`,
      `- 岗位：${field(job.roleTitle)}`,
      `- 当前阶段：${getStageDisplayLabel(application.currentStage)}`,
      `- Base：${field(job.city)}`,
      `- 行业：${field(job.industry)}`,
      `- 投递时间：${formatOptionalDateTime(application.appliedAt)}`,
      `- 来源：${field(job.sourceName)}`,
      `- 来源链接：${field(job.sourceUrl)}`,
      "",
      "## 当前事项",
      "",
      `- 下一步行动：${field(application.nextAction)}`,
      `- 备注：${field(application.note)}`,
      "",
      "## 岗位职责",
      "",
      storedJobText(job.responsibilities, "未保存岗位职责"),
      "",
      "## 岗位要求",
      "",
      storedJobText(job.requirements, "未保存岗位要求"),
      "",
      "## JD 原文",
      "",
      job.rawContent.trim() ? job.rawContent : "未保存完整 JD 原文",
      "",
      "## 所用简历",
      ""
    );

    if (!application.usedResume) {
      lines.push("未关联简历。");
    } else {
      const document = confirmedResumes.get(application.usedResume.id);
      lines.push(
        `- 简历标题：${field(application.usedResume.title)}`,
        `- 是否主简历：${application.usedResume.isPrimary ? "是" : "否"}`
      );
      if (document) {
        lines.push("", "### 简历正文 / 结构化内容", "", formatResumeDocument(document) || "已确认的结构化简历内容为空");
      } else {
        lines.push("", "未找到已确认的结构化简历内容。");
      }
    }

    lines.push("", "## 招聘事件", "");
    const events = sortEvents(application.events);
    if (events.length === 0) {
      lines.push("未保存招聘事件。");
      return;
    }

    events.forEach((event, eventIndex) => {
      const details = readEventExcerpts(event.detailsJson);
      lines.push(
        `### 事件 ${eventIndex + 1}`,
        "",
        `- 类型：${getEventTypeLabel(event.eventType)}`,
        `- 标题：${field(event.title)}`,
        `- 时间：${formatOptionalDateTime(event.eventTime)}`,
        `- 开放时间：${formatOptionalDateTime(event.windowStartAt)}`,
        `- 截止时间：${formatOptionalDateTime(event.deadlineAt)}`,
        `- 状态：${eventStatusLabel(event.status)}`
      );
      if (details.requirements.length > 0) {
        lines.push("", "#### 要求原文", "", ...details.requirements);
      }
      if (details.actions.length > 0) {
        lines.push("", "#### 后续动作原文", "", ...details.actions);
      }
      if (eventIndex < events.length - 1) lines.push("");
    });
  });

  return `${lines.join("\n")}\n`;
}

export function interviewPrepFileName(value: Date) {
  return `interview-prep-context_${formatWallClockDate(value)}.md`;
}

function sortEvents(events: ExportEvent[]) {
  return [...events].sort((left, right) => {
    const leftTime = (left.eventTime ?? left.createdAt).getTime();
    const rightTime = (right.eventTime ?? right.createdAt).getTime();
    return leftTime - rightTime || left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id);
  });
}

function storedJobText(value: string, emptyText: string) {
  if (!value.trim()) return emptyText;
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
      return parsed.length > 0 ? parsed.join("\n") : emptyText;
    }
  } catch {
    // Legacy records may contain plain text rather than a JSON array.
  }
  return value;
}

function readEventExcerpts(detailsJson: string) {
  try {
    const details: unknown = JSON.parse(detailsJson);
    const object = record(details);
    const extraction = record(object?.extraction);
    const requirements = textExcerpts(object?.requirements);
    const actions = textExcerpts(object?.actions);
    return {
      requirements: requirements.length > 0 ? requirements : textExcerpts(extraction?.requirements),
      actions: actions.length > 0 ? actions : textExcerpts(extraction?.actions)
    };
  } catch {
    return { requirements: [], actions: [] };
  }
}

function textExcerpts(value: unknown) {
  if (typeof value === "string") return value ? [value] : [];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function field(value: string | null | undefined) {
  return value?.trim() || "未填写";
}

function formatOptionalDateTime(value: Date | null) {
  return value ? formatDateTime(value) : "未设置";
}

function formatDateTime(value: Date) {
  return formatWallClockDateTime(value)?.replace("T", " ") ?? "未设置";
}

function eventStatusLabel(status: EventStatus) {
  if (status === "ACTIVE") return "待处理";
  if (status === "COMPLETED") return "已完成";
  return "已忽略";
}
