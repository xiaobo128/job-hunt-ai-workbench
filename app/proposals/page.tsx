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

  return <PageShell title="Agent 写入确认" description="Agent 只能准备变更；只有你在此页面确认后，MCP 才能执行已确认的精确内容。">
    <div className="space-y-4">
      {proposals.length === 0 ? <div className="rounded-3xl border border-line bg-white p-6 text-sm text-slate-500 shadow-card">暂无待确认的 Agent 变更。</div> : proposals.map((proposal) => (
        <article key={proposal.id} className="rounded-3xl border border-line bg-white p-5 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="text-lg font-semibold text-ink">{proposal.application.jobLead.companyName} · {proposal.application.jobLead.roleTitle}</h2><p className="mt-1 text-sm text-slate-500">{proposalTypeLabel(proposal.type)} · 创建于 {formatDate(proposal.createdAt)}</p></div>
            <span className="rounded-full border border-line px-3 py-1 text-xs font-medium text-slate-600">{statusLabel(proposal.status)}</span>
          </div>
          <section className="mt-4 rounded-2xl bg-slate-50 p-4"><h3 className="text-sm font-medium text-ink">拟议变更</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{describePayload(proposal.type, proposal.payloadJson)}</p></section>
          <section className="mt-3 rounded-2xl border border-line p-4"><h3 className="text-sm font-medium text-ink">来源与证据</h3><p className="mt-2 text-sm text-slate-600">{proposal.sourceType}{proposal.sourceIdentifier ? ` · ${proposal.sourceIdentifier}` : ""}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{proposal.evidenceText}</p></section>
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

function describePayload(type: AgentProposalType, payloadJson: string) {
  try {
    const payload = JSON.parse(payloadJson) as Record<string, unknown>;
    if (type === AgentProposalType.APPLICATION_STATUS_UPDATE) {
      const lines = [`阶段：${typeof payload.requestedStage === "string" ? getStageLabel(payload.requestedStage as never) : "无效"}`];
      if ("nextAction" in payload) lines.push(`下一步：${payload.nextAction || "清空"}`);
      if ("submissionChannel" in payload) lines.push(`投递渠道：${payload.submissionChannel || "清空"}`);
      if ("note" in payload) lines.push(`备注：${payload.note || "清空"}`);
      return lines.join("\n");
    }
    return `类型：${typeof payload.eventType === "string" ? getEventTypeLabel(payload.eventType as never) : "无效"}\n标题：${typeof payload.title === "string" ? payload.title : "无效"}\n${typeof payload.detailsJson === "string" ? payload.detailsJson : ""}`;
  } catch {
    return "无法读取拟议内容";
  }
}
