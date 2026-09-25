import { AgentProposalStatus, AgentProposalType } from "@prisma/client";
import { PageShell } from "@/components/app-shell";
import { getStageLabel } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { getEventTypeLabel } from "@/lib/event-types";
import { formatDate } from "@/lib/format";
import { requireSessionUser } from "@/lib/session";
import { confirmProposalAction, rejectProposalAction } from "./actions";

export default async function ProposalsPage() {
  const user = await requireSessionUser();
  const proposals = await prisma.agentProposal.findMany({
    where: { userId: user.id, application: { jobLead: { ownerId: user.id } } },
    select: {
      id: true, type: true, payloadJson: true, sourceType: true, sourceIdentifier: true, evidenceText: true, status: true, createdAt: true,
      application: { select: { jobLead: { select: { companyName: true, roleTitle: true } } } }
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100
  });

  return <PageShell title="待确认事项" description="确认后，系统会按下方内容更新你的求职记录。">
    <div className="space-y-4">
      {proposals.length === 0 ? <div className="rounded-3xl border border-line bg-white p-6 text-sm text-slate-500 shadow-card">暂无待确认事项。</div> : proposals.map((proposal) => (
        <article key={proposal.id} className="rounded-3xl border border-line bg-white p-5 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="text-lg font-semibold text-ink">{proposal.application.jobLead.companyName} · {proposal.application.jobLead.roleTitle}</h2><p className="mt-1 text-sm text-slate-500">{proposalTypeLabel(proposal.type)} · 创建于 {formatDate(proposal.createdAt)}</p></div>
            <span className="rounded-full border border-line px-3 py-1 text-xs font-medium text-slate-600">{statusLabel(proposal.status)}</span>
          </div>
          <ProposalChange type={proposal.type} payloadJson={proposal.payloadJson} />
          <SourceEvidence evidenceText={proposal.evidenceText} />
          {proposal.status === AgentProposalStatus.PENDING ? <div className="mt-4 flex gap-3"><form action={confirmProposalAction}><input type="hidden" name="proposalId" value={proposal.id} /><button className="rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white">确认</button></form><form action={rejectProposalAction}><input type="hidden" name="proposalId" value={proposal.id} /><button className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-ink">拒绝</button></form></div> : null}
        </article>
      ))}
    </div>
  </PageShell>;
}

function proposalTypeLabel(type: AgentProposalType) {
  return type === AgentProposalType.APPLICATION_STATUS_UPDATE ? "更新申请阶段" : "新增申请事件";
}

function statusLabel(status: AgentProposalStatus) {
  return status === AgentProposalStatus.PENDING ? "待确认" : status === AgentProposalStatus.CONFIRMED ? "已确认，待执行" : status === AgentProposalStatus.EXECUTED ? "已执行" : "已拒绝";
}

function ProposalChange({ type, payloadJson }: { type: AgentProposalType; payloadJson: string }) {
  const payload = parseObject(payloadJson);
  if (!payload) return <section className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">无法读取此项变更内容。</section>;

  if (type === AgentProposalType.APPLICATION_STATUS_UPDATE) {
    return <section className="mt-4 rounded-2xl bg-slate-50 p-4"><h3 className="text-sm font-medium text-ink">即将发生的变化</h3><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><ChangeField label="申请阶段" value={typeof payload.requestedStage === "string" ? getStageLabel(payload.requestedStage as never) : null} /><ChangeField label="下一步行动" value={textValue(payload.nextAction)} /></dl></section>;
  }

  const details = parseObject(textValue(payload.detailsJson));
  const extraction = details ? parseObject(details.extraction) : null;
  const eventType = textValue(payload.eventType);
  const eventTime = textValue(payload.eventTime);
  const deliveryMode = textValue(extraction?.deliveryMode);
  const onlineUrl = textValue(extraction?.onlineUrl);
  const actions = textList(extraction?.actions);

  return <section className="mt-4 rounded-2xl bg-slate-50 p-4"><h3 className="text-sm font-medium text-ink">即将发生的变化</h3><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><ChangeField label="事件类型" value={eventType ? getEventTypeLabel(eventType) : null} /><ChangeField label="面试/测评时间" value={eventTime ? formatDate(eventTime) : null} /><ChangeField label="方式" value={deliveryModeLabel(deliveryMode)} /><ChangeField label="下一步行动" value={actions.length ? actions.join("；") : null} />{onlineUrl ? <div><dt className="text-xs font-medium text-slate-500">链接</dt><dd className="mt-1"><a href={onlineUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-ink underline underline-offset-4">打开会议链接</a></dd></div> : null}</dl></section>;
}

function ChangeField({ label, value }: { label: string; value: string | null }) {
  return <div><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="mt-1 text-sm leading-6 text-slate-700">{value || "未提供"}</dd></div>;
}

function SourceEvidence({ evidenceText }: { evidenceText: string }) {
  const evidence = splitEvidence(evidenceText);
  return <details className="mt-3 rounded-2xl border border-line p-4"><summary className="cursor-pointer text-sm font-medium text-ink">查看来源证据</summary><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><ChangeField label="Subject" value={evidence.subject} /><ChangeField label="Sender" value={evidence.sender} /><ChangeField label="Received-At" value={evidence.receivedAt} /></dl><div className="mt-4"><div className="text-xs font-medium text-slate-500">原始通知内容</div><pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap text-sm leading-6 text-slate-700">{evidence.content || "未提供"}</pre></div></details>;
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
  return {
    subject: evidenceHeader(headers, "Subject"),
    sender: evidenceHeader(headers, "Sender"),
    receivedAt: evidenceHeader(headers, "Received-At"),
    content
  };
}

function evidenceHeader(headers: string, name: string) {
  const prefix = `${name}:`;
  const line = headers.split("\n").find((item) => item.startsWith(prefix));
  return line ? line.slice(prefix.length).trim() || null : null;
}
