import { AgentProposalStatus, AgentProposalType, type ApplicationStage } from "@prisma/client";
import React from "react";
import { getStageLabel } from "@/lib/constants";
import { getEventTypeLabel } from "@/lib/event-types";
import { formatDate } from "@/lib/format";
import { formatWallClockDisplay } from "@/lib/wall-clock";
import { confirmProposalAction, rejectProposalAction } from "../actions";

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
  };
};

export function ProposalCard({ proposal }: { proposal: ProposalCardData }) {
  return (
    <article className="rounded-3xl border border-line bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">
            {proposal.application.jobLead.companyName} · {proposal.application.jobLead.roleTitle}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {proposalTypeLabel(proposal.type)} · 创建于 {formatDate(proposal.createdAt)}
          </p>
        </div>
        <span className="rounded-full border border-line px-3 py-1 text-xs font-medium text-slate-600">
          {statusLabel(proposal.status)}
        </span>
      </div>

      <ProposalChange type={proposal.type} payloadJson={proposal.payloadJson} currentStage={proposal.application.currentStage} />
      {proposal.type === AgentProposalType.APPLICATION_EVENT_APPEND ? (
        <NotificationOriginal sourceType={proposal.sourceType} sourceIdentifier={proposal.sourceIdentifier} evidenceText={proposal.evidenceText} />
      ) : (
        <ProposalSource sourceType={proposal.sourceType} sourceIdentifier={proposal.sourceIdentifier} evidenceText={proposal.evidenceText} />
      )}

      {proposal.status === AgentProposalStatus.PENDING ? (
        <div className="mt-4 flex gap-3">
          <form action={confirmProposalAction}>
            <input type="hidden" name="proposalId" value={proposal.id} />
            <button className="rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white">
              {proposal.type === AgentProposalType.APPLICATION_STATUS_UPDATE ? "确认并执行" : "确认"}
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
  return type === AgentProposalType.APPLICATION_STATUS_UPDATE ? "更新申请阶段" : "新增申请事件";
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

function ProposalChange({ type, payloadJson, currentStage }: { type: AgentProposalType; payloadJson: string; currentStage: ApplicationStage }) {
  const payload = parseObject(payloadJson);
  if (!payload) return <section className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">无法读取此项变更内容。</section>;

  if (type === AgentProposalType.APPLICATION_STATUS_UPDATE) {
    return (
      <section className="mt-4 rounded-2xl bg-slate-50 p-4">
        <h3 className="text-sm font-medium text-ink">即将发生的变化</h3>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <ChangeField label="申请阶段" value={typeof payload.requestedStage === "string" ? `${getStageLabel(currentStage)} → ${getStageLabel(payload.requestedStage as ApplicationStage)}` : null} />
          {textValue(payload.nextAction) ? <ChangeField label="下一步行动" value={textValue(payload.nextAction)} /> : null}
          {textValue(payload.note) ? <ChangeField label="备注" value={textValue(payload.note)} /> : null}
        </dl>
      </section>
    );
  }

  const details = parseObject(textValue(payload.detailsJson));
  const extraction = details ? parseObject(details.extraction) : null;
  const eventType = textValue(payload.eventType);
  const schedule = extraction ? parseObject(extraction.schedule) : null;
  const deliveryMode = textValue(extraction?.deliveryMode);
  const onlineUrl = textValue(extraction?.onlineUrl);
  const actions = textList(extraction?.actions);
  const requirements = textList(details?.requirements);

  return (
    <section className="mt-4 rounded-2xl bg-slate-50 p-4">
      <h3 className="text-sm font-medium text-ink">即将发生的变化</h3>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <ChangeField label="事件类型" value={eventType ? getEventTypeLabel(eventType) : null} />
        <ScheduleChange schedule={schedule} />
        <ChangeField label="方式" value={deliveryModeLabel(deliveryMode)} />
        <ChangeField label="后续动作（原文摘录）" value={actions.length ? actions.join("；") : null} />
        <ChangeField label="要求事项（原文摘录）" value={requirements.length ? requirements.join("；") : null} />
        {onlineUrl ? <div><dt className="text-xs font-medium text-slate-500">链接</dt><dd className="mt-1"><a href={onlineUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-ink underline underline-offset-4">打开会议链接</a></dd></div> : null}
      </dl>
    </section>
  );
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
