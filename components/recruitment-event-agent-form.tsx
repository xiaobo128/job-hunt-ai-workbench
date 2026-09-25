"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  processRecruitmentEvent,
  type RecruitmentEventAgentState
} from "@/app/recruitment-event-agent/actions";

const initialRecruitmentEventAgentState: RecruitmentEventAgentState = { status: "idle" };

export function RecruitmentEventAgentForm() {
  const [state, formAction] = useActionState(processRecruitmentEvent, initialRecruitmentEventAgentState);

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-4 rounded-3xl border border-line bg-white p-5 shadow-card">
        <div>
          <h2 className="text-lg font-semibold text-ink">粘贴招聘通知</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">支持手工粘贴邮件或短信；不会连接 Gmail 或读取邮箱。</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="邮件主题" name="subject" placeholder="例如：产品经理一面邀请" />
          <Field label="发件人" name="sender" placeholder="recruiting@example.com" />
          <Field label="接收时间（可选）" name="receivedAt" placeholder="2026-09-25T09:30:00+08:00" />
          <Field label="Message-ID / 来源标识（可选）" name="identifier" placeholder="<message-id@example.com>" />
        </div>
        <label className="block text-sm text-slate-600">
          通知正文
          <textarea
            required
            name="content"
            rows={14}
            className="mt-2 w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm leading-6 text-ink outline-none"
            placeholder="粘贴原始招聘邮件、面试邀请或笔试通知正文。"
          />
        </label>
        {state.status === "error" ? <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{state.message}</p> : null}
        <div className="flex justify-end"><SubmitButton /></div>
      </form>

      {state.status === "success" ? <Result state={state} /> : null}
    </div>
  );
}

function Field({ label, name, placeholder }: { label: string; name: string; placeholder: string }) {
  return (
    <label className="block text-sm text-slate-600">
      {label}
      <input name={name} className="mt-2 w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-ink outline-none" placeholder={placeholder} />
    </label>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="rounded-2xl bg-ink px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-70">{pending ? "正在分析…" : "分析并准备 Proposal"}</button>;
}

function Result({ state }: { state: RecruitmentEventAgentState }) {
  const extraction = state.extraction;
  const proposal = state.proposal;

  if (!extraction || !proposal) return null;

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-line bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-ink">提取结果</h2><p className="mt-1 text-sm text-slate-500">{state.note}</p></div><span className="rounded-full border border-line px-3 py-1 text-xs text-slate-600">{state.provider}</span></div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <ResultValue label="公司线索" value={extraction.companyHint} />
          <ResultValue label="岗位线索" value={extraction.roleHint} />
          <ResultValue label="事件类型" value={extraction.eventType} />
          <ResultValue label="意图" value={extraction.intent} />
          <ResultValue label="事件时间" value={extraction.eventTime} />
          <ResultValue label="截止时间" value={extraction.deadline} />
          <ResultValue label="方式" value={extraction.deliveryMode} />
          <ResultValue label="线上链接" value={extraction.onlineUrl} />
          <ResultValue label="线下地点" value={extraction.offlineAddress} />
          <ResultValue label="行动项" value={extraction.actions} />
          <ResultValue label="要求" value={extraction.requirements} />
          <ResultValue label="摘要" value={extraction.summary} />
        </dl>
        <details className="mt-4 rounded-2xl bg-panel p-4"><summary className="cursor-pointer text-sm font-medium text-ink">来源证据</summary><pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-700">{extraction.evidenceText}</pre></details>
      </section>

      <section className="rounded-3xl border border-line bg-white p-5 shadow-card">
        <h2 className="text-lg font-semibold text-ink">申请匹配</h2>
        {state.matches?.length ? <div className="mt-4 space-y-3">{state.matches.map((match) => <article key={match.applicationId} className="rounded-2xl border border-line p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-medium text-ink">{match.companyName} · {match.roleTitle}</h3><p className="mt-1 text-sm text-slate-500">{match.reasons.join("；") || "基础文本相似度"}</p></div><span className={`rounded-full px-3 py-1 text-xs font-medium ${confidenceClass(match.confidence)}`}>{match.confidence} · {match.score}</span></div></article>)}</div> : <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">没有足够证据匹配到现有申请。</p>}
      </section>

      <section className="rounded-3xl border border-line bg-white p-5 shadow-card">
        <h2 className="text-lg font-semibold text-ink">Proposal 结果</h2>
        {proposal.created ? <div className="mt-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800"><p>已为 HIGH confidence 匹配创建待确认 Proposal：<span className="font-mono text-xs">{proposal.proposalId}</span></p><Link href="/proposals" className="mt-3 inline-flex rounded-xl bg-ink px-3 py-2 text-sm font-medium text-white">前往确认</Link></div> : <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{proposalMessage(proposal.reason)} 未创建 Proposal。</p>}
      </section>
    </div>
  );
}

function ResultValue({ label, value }: { label: string; value: string | readonly string[] | null }) {
  const text = Array.isArray(value) ? value.join("；") : value;
  return <div><dt className="text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-ink">{text || "未知"}</dd></div>;
}

function confidenceClass(confidence: "HIGH" | "MEDIUM" | "LOW") {
  return confidence === "HIGH" ? "bg-emerald-100 text-emerald-800" : confidence === "MEDIUM" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700";
}

function proposalMessage(reason: "UNKNOWN_EVENT_TYPE" | "NO_HIGH_CONFIDENCE_MATCH" | "AMBIGUOUS_HIGH_CONFIDENCE_MATCH") {
  if (reason === "UNKNOWN_EVENT_TYPE") return "事件类型未知";
  if (reason === "AMBIGUOUS_HIGH_CONFIDENCE_MATCH") return "存在多个同等高置信候选";
  return "没有唯一 HIGH confidence 匹配";
}
