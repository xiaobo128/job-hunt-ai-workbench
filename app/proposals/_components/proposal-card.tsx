import { AgentProposalStatus, AgentProposalType, type ApplicationStage } from "@prisma/client";
import React from "react";
import { getStageLabel } from "@/lib/constants";
import { getEventTypeLabel } from "@/lib/event-types";
import { formatDate } from "@/lib/format";
import type { ProposalEventReview } from "@/lib/proposal-event-review";
import { formatWallClockDisplay } from "@/lib/wall-clock";
import { confirmApplicationEventUpdateProposalAction, confirmJobApplicationCreateProposalAction, confirmProposalAction, confirmRecruitmentEventProposalAction, rejectProposalAction } from "../actions";

export type ProposalCardData = {
  id: string;
  type: AgentProposalType;
  payloadJson: string;
  sourceType: string;
  sourceIdentifier: string | null;
  evidenceText: string;
  status: AgentProposalStatus;
  createdAt: Date;
  application: {
    currentStage: ApplicationStage;
    jobLead: { companyName: string; roleTitle: string };
  } | null;
};

export function ProposalCard({ proposal, reviewEvent = null }: { proposal: ProposalCardData; reviewEvent?: ProposalEventReview | null }) {
  const payload = parseObject(proposal.payloadJson);
  const createJob = proposal.type === AgentProposalType.JOB_APPLICATION_CREATE ? parseObject(payload?.job) : null;
  const companyName = proposal.application?.jobLead.companyName ?? textValue(createJob?.companyName) ?? "未提供公司";
  const roleTitle = proposal.application?.jobLead.roleTitle ?? textValue(createJob?.roleTitle) ?? "未提供岗位";
  return (
    <article className="rounded-3xl border border-line bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">
            {companyName} · {roleTitle}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {proposalTypeLabel(proposal.type)} · 创建于 {formatDate(proposal.createdAt)}
          </p>
        </div>
        <span className="rounded-full border border-line px-3 py-1 text-xs font-medium text-slate-600">
          {statusLabel(proposal.status)}
        </span>
      </div>

      <ProposalChange type={proposal.type} payloadJson={proposal.payloadJson} currentStage={proposal.application?.currentStage ?? null} reviewEvent={reviewEvent} />
      {proposal.type === AgentProposalType.APPLICATION_EVENT_APPEND ? (
        <NotificationOriginal sourceType={proposal.sourceType} sourceIdentifier={proposal.sourceIdentifier} evidenceText={proposal.evidenceText} />
      ) : proposal.type === AgentProposalType.JOB_APPLICATION_CREATE || proposal.type === AgentProposalType.APPLICATION_EVENT_UPDATE ? (
        null
      ) : (
        <ProposalSource sourceType={proposal.sourceType} sourceIdentifier={proposal.sourceIdentifier} evidenceText={proposal.evidenceText} />
      )}

      {proposal.status === AgentProposalStatus.PENDING ? (
        <div className="mt-4 flex gap-3">
          <form action={confirmationAction(proposal.type)}>
            <input type="hidden" name="proposalId" value={proposal.id} />
            <button className="rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white">
              {proposal.type === AgentProposalType.JOB_APPLICATION_CREATE
                ? "确认并创建"
                : proposal.type === AgentProposalType.APPLICATION_EVENT_UPDATE
                  ? "确认并修改"
                  : "确认并执行"}
            </button>
          </form>
          <form action={rejectProposalAction}>
            <input type="hidden" name="proposalId" value={proposal.id} />
            <button className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-ink">拒绝</button>
          </form>
        </div>
      ) : (
        <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{proposalStatusMessage(proposal.status)}</p>
      )}
    </article>
  );
}

export function proposalTypeLabel(type: AgentProposalType) {
  if (type === AgentProposalType.APPLICATION_STATUS_UPDATE) return "更新申请阶段";
  if (type === AgentProposalType.APPLICATION_EVENT_APPEND) return "新增申请事件";
  if (type === AgentProposalType.APPLICATION_EVENT_UPDATE) return "修改招聘通知";
  return "新增求职记录";
}

export function statusLabel(status: AgentProposalStatus) {
  return status === AgentProposalStatus.PENDING
    ? "待确认"
    : status === AgentProposalStatus.CONFIRMED
      ? "已确认，待执行"
      : status === AgentProposalStatus.EXECUTED
        ? "已执行"
        : "已拒绝";
}

function proposalStatusMessage(status: AgentProposalStatus) {
  if (status === AgentProposalStatus.EXECUTED) return "该变更已经执行，不能再次执行。";
  if (status === AgentProposalStatus.CONFIRMED) return "该建议已经确认，当前不能再次确认。";
  if (status === AgentProposalStatus.REJECTED) return "该建议已被拒绝，未修改申请。";
  return "";
}

function ProposalChange({ type, payloadJson, currentStage, reviewEvent }: { type: AgentProposalType; payloadJson: string; currentStage: ApplicationStage | null; reviewEvent: ProposalEventReview | null }) {
  const payload = parseObject(payloadJson);
  if (!payload) return <section className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">无法读取此项变更内容。</section>;

  if (type === AgentProposalType.APPLICATION_STATUS_UPDATE) {
    return (
      <section className="mt-4 rounded-2xl bg-slate-50 p-4">
        <h3 className="text-sm font-medium text-ink">即将发生的变化</h3>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <ChangeField label="申请阶段" value={typeof payload.requestedStage === "string" && currentStage ? `${getStageLabel(currentStage)} → ${getStageLabel(payload.requestedStage as ApplicationStage)}` : null} />
          {textValue(payload.nextAction) ? <ChangeField label="下一步行动" value={textValue(payload.nextAction)} /> : null}
          {textValue(payload.note) ? <ChangeField label="备注" value={textValue(payload.note)} /> : null}
        </dl>
      </section>
    );
  }

  if (type === AgentProposalType.JOB_APPLICATION_CREATE) {
    return <JobApplicationCreateChange payload={payload} />;
  }

  if (type === AgentProposalType.APPLICATION_EVENT_UPDATE) {
    return <ApplicationEventUpdateChange payload={payload} event={reviewEvent} />;
  }

  const details = parseObject(textValue(payload.detailsJson));
  const extraction = details ? parseObject(details.extraction) : null;
  const eventType = textValue(payload.eventType);
  const schedule = extraction ? parseObject(extraction.schedule) : null;
  const deliveryMode = textValue(extraction?.deliveryMode);
  const onlineUrl = textValue(extraction?.onlineUrl);
  const offlineAddress = textValue(extraction?.offlineAddress);
  const actions = textList(extraction?.actions);
  const requirements = textList(details?.requirements);

  return (
    <section className="mt-4 rounded-2xl bg-slate-50 p-4">
      <h3 className="text-sm font-medium text-ink">即将发生的变化</h3>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <ChangeField label="新增通知" value={textValue(payload.title)} />
        <ChangeField label="事件类型" value={eventType ? getEventTypeLabel(eventType) : null} />
        <ScheduleChange schedule={schedule} />
        <ChangeField label="方式" value={deliveryModeLabel(deliveryMode)} />
        <ChangeField label="地点" value={offlineAddress} />
        <ChangeField label="后续动作（原文摘录）" value={actions.length ? actions.join("；") : null} />
        <ChangeField label="要求事项（原文摘录）" value={requirements.length ? requirements.join("；") : null} />
        {onlineUrl ? <div><dt className="text-xs font-medium text-slate-500">链接</dt><dd className="mt-1"><a href={onlineUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-ink underline underline-offset-4">打开会议链接</a></dd></div> : null}
      </dl>
    </section>
  );
}

function ApplicationEventUpdateChange({ payload, event }: { payload: Record<string, unknown>; event: ProposalEventReview | null }) {
  const patch = parseObject(payload.patch);
  if (!patch || !event) {
    return <section className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">无法读取待修改的招聘通知。</section>;
  }

  const details = parseObject(event.detailsJson) ?? {};
  const current = {
    eventType: event.eventType,
    status: event.status,
    title: event.title,
    eventTime: event.eventTime,
    windowStartAt: event.windowStartAt,
    deadlineAt: event.deadlineAt,
    receivedAt: event.receivedAt,
    relativeValidityMinutes: event.relativeValidityMinutes,
    content: typeof details.content === "string" ? details.content : "",
    requirements: textList(details.requirements)
  };
  const fields = Object.keys(patch);
  const contextualFields = fields.includes("deadlineAt") && event.receivedAt && event.relativeValidityMinutes
    ? ["deadlineAt", "receivedAt", "relativeValidityMinutes", ...fields]
    : fields;
  const visibleFields = [...new Set(contextualFields)];

  return (
    <section className="mt-4 rounded-2xl bg-slate-50 p-4">
      <h3 className="text-sm font-medium text-ink">修改招聘通知</h3>
      <p className="mt-1 text-sm text-slate-600">通知：{event.title}</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <EventUpdateValues title="修改前" fields={visibleFields} values={current} />
        <EventUpdateValues title="修改后" fields={visibleFields} values={{ ...current, ...patch }} />
      </div>
    </section>
  );
}

function EventUpdateValues({ title, fields, values }: { title: string; fields: string[]; values: Record<string, unknown> }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <h4 className="text-sm font-medium text-ink">{title}</h4>
      <dl className="mt-3 space-y-3">
        {fields.map((field) => <ChangeField key={field} label={eventUpdateFieldLabel(field)} value={eventUpdateFieldValue(field, values[field])} />)}
      </dl>
    </div>
  );
}

function eventUpdateFieldLabel(field: string) {
  if (field === "eventType") return "通知类型";
  if (field === "status") return "状态";
  if (field === "title") return "标题";
  if (field === "eventTime") return "安排时间";
  if (field === "windowStartAt") return "开放时间";
  if (field === "deadlineAt") return "截止时间";
  if (field === "receivedAt") return "接收时间";
  if (field === "relativeValidityMinutes") return "有效期";
  if (field === "content") return "原始邮件正文";
  if (field === "requirements") return "要求事项";
  return "变更字段";
}

function eventUpdateFieldValue(field: string, value: unknown) {
  if (field === "eventType") return typeof value === "string" ? getEventTypeLabel(value) : null;
  if (field === "status") return value === "ACTIVE" ? "待处理" : value === "COMPLETED" ? "已完成" : value === "IGNORED" ? "已忽略" : null;
  if (field === "eventTime" || field === "windowStartAt" || field === "receivedAt") {
    return value instanceof Date || typeof value === "string" ? formatWallClockDisplay(value) : "未设置";
  }
  if (field === "deadlineAt") {
    return value instanceof Date || typeof value === "string" ? formatWallClockDisplay(value) : "未单独记录";
  }
  if (field === "relativeValidityMinutes") return typeof value === "number" ? relativeValidityLabel(value) : "未设置";
  if (field === "requirements") {
    const values = textList(value);
    return values.length ? values.join("；") : "未提供";
  }
  return typeof value === "string" && value ? value : "未提供";
}

function relativeValidityLabel(minutes: number) {
  if (minutes % (24 * 60) === 0) return `${minutes / (24 * 60)} 天`;
  if (minutes % 60 === 0) return `${minutes / 60} 小时`;
  return `${minutes} 分钟`;
}

function JobApplicationCreateChange({ payload }: { payload: Record<string, unknown> }) {
  const job = parseObject(payload.job);
  const application = parseObject(payload.application);
  const requestedStage = textValue(application?.requestedStage) as ApplicationStage | null;
  return (
    <section className="mt-4 rounded-2xl bg-slate-50 p-4">
      <h3 className="text-sm font-medium text-ink">新增求职记录</h3>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <ChangeField label="公司" value={textValue(job?.companyName)} />
        <ChangeField label="岗位" value={textValue(job?.roleTitle)} />
        <ChangeField label="地点" value={textValue(job?.city)} />
        <ChangeField label="行业" value={textValue(job?.industry)} />
        <ChangeField label="职级" value={textValue(job?.seniority)} />
        <ChangeField label="薪资" value={textValue(job?.salaryRange)} />
        <ChangeField label="初始状态" value={requestedStage ? getStageLabel(requestedStage) : null} />
        <ChangeField label="投递时间" value={requestedStage === "APPLIED" ? "确认创建时自动记录" : null} />
        <ChangeField label="来源类型" value={textValue(job?.sourceType)} />
        <ChangeField label="来源名称" value={textValue(job?.sourceName)} />
        <ChangeField label="投递渠道" value={textValue(application?.submissionChannel)} />
        <ChangeField label="下一步行动" value={textValue(application?.nextAction)} />
        <ChangeField label="备注" value={textValue(application?.note)} />
        {textValue(job?.sourceUrl) ? <div><dt className="text-xs font-medium text-slate-500">来源链接</dt><dd className="mt-1"><a href={textValue(job?.sourceUrl) as string} target="_blank" rel="noreferrer" className="text-sm font-medium text-ink underline underline-offset-4">打开岗位链接</a></dd></div> : <ChangeField label="来源链接" value={null} />}
      </dl>
      <TextListSection title="技能关键词" values={textList(job?.skills)} />
      <TextListSection title="岗位职责" values={textList(job?.responsibilities)} />
      <TextListSection title="岗位要求" values={textList(job?.requirements)} />
      <div className="mt-4"><div className="text-xs font-medium text-slate-500">原始依据 / JD</div><pre className="mt-1 max-h-96 overflow-auto whitespace-pre-wrap text-sm leading-6 text-slate-700">{textValue(job?.rawContent) ?? "未提供"}</pre></div>
    </section>
  );
}

function TextListSection({ title, values }: { title: string; values: string[] }) {
  return <div className="mt-4"><div className="text-xs font-medium text-slate-500">{title}</div><div className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{values.length ? values.join("\n") : "未提供"}</div></div>;
}

function confirmationAction(type: AgentProposalType) {
  if (type === AgentProposalType.APPLICATION_EVENT_APPEND) return confirmRecruitmentEventProposalAction;
  if (type === AgentProposalType.APPLICATION_EVENT_UPDATE) return confirmApplicationEventUpdateProposalAction;
  if (type === AgentProposalType.JOB_APPLICATION_CREATE) return confirmJobApplicationCreateProposalAction;
  return confirmProposalAction;
}

function ProposalSource({ sourceType, sourceIdentifier, evidenceText }: { sourceType: string; sourceIdentifier: string | null; evidenceText: string }) {
  return <details className="mt-3 rounded-2xl border border-line p-4"><summary className="cursor-pointer text-sm font-medium text-ink">查看建议来源</summary><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><ChangeField label="Proposal 来源" value={sourceType} />{sourceIdentifier ? <ChangeField label="来源标识" value={sourceIdentifier} /> : null}</dl><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{evidenceText}</p></details>;
}

function ChangeField({ label, value }: { label: string; value: string | null }) {
  return <div><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="mt-1 text-sm leading-6 text-slate-700">{value || "未提供"}</dd></div>;
}

function ScheduleChange({ schedule }: { schedule: Record<string, unknown> | null }) {
  const type = textValue(schedule?.type);
  const startAt = textValue(schedule?.startAt);
  const endAt = textValue(schedule?.endAt);
  if (type === "FIXED_TIME") return <ChangeField label="固定时间" value={startAt ? formatWallClockDisplay(startAt) : null} />;
  if (type === "TIME_WINDOW") return <ChangeField label="有效时间" value={`${startAt ? formatWallClockDisplay(startAt) : "未提供"} 至 ${endAt ? formatWallClockDisplay(endAt) : "未提供"}`} />;
  if (type === "DEADLINE") return <ChangeField label="截止时间" value={endAt ? formatWallClockDisplay(endAt) : null} />;
  return null;
}

function NotificationOriginal({ sourceType, sourceIdentifier, evidenceText }: { sourceType: string; sourceIdentifier: string | null; evidenceText: string }) {
  const evidence = splitEvidence(evidenceText);
  return <details className="mt-3 rounded-2xl border border-line p-4"><summary className="cursor-pointer text-sm font-medium text-ink">查看通知原文</summary><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><ChangeField label="Proposal 来源" value={sourceType} />{sourceIdentifier ? <ChangeField label="来源标识" value={sourceIdentifier} /> : null}{evidence.subject ? <ChangeField label="Subject" value={evidence.subject} /> : null}{evidence.sender ? <ChangeField label="Sender" value={evidence.sender} /> : null}{evidence.receivedAt ? <ChangeField label="Received-At" value={evidence.receivedAt} /> : null}</dl><div className="mt-4"><div className="text-xs font-medium text-slate-500">通知原文</div><pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap text-sm leading-6 text-slate-700">{evidence.content || "未提供"}</pre></div></details>;
}

function parseObject(value: unknown) {
  if (typeof value !== "string") return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function textList(value: unknown) {
  return Array.isArray(value) ? value.flatMap((item) => textValue(item) ? [textValue(item) as string] : []) : [];
}

function deliveryModeLabel(value: string | null) {
  return value === "ONLINE" ? "线上" : value === "OFFLINE" ? "线下" : value === "HYBRID" ? "线上和线下" : null;
}

function splitEvidence(evidenceText: string) {
  const normalized = evidenceText.replace(/\r\n/g, "\n");
  const separator = normalized.indexOf("\n\n");
  const headers = separator < 0 ? normalized : normalized.slice(0, separator);
  const content = separator < 0 ? "" : normalized.slice(separator + 2).trim();
  return { subject: evidenceHeader(headers, "Subject"), sender: evidenceHeader(headers, "Sender"), receivedAt: evidenceHeader(headers, "Received-At"), content };
}

function evidenceHeader(headers: string, name: string) {
  const prefix = `${name}:`;
  const line = headers.split("\n").find((item) => item.startsWith(prefix));
  const value = line ? line.slice(prefix.length).trim() : "";
  return value && value !== "(not provided)" ? value : null;
}
