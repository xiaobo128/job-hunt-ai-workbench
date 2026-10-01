"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  processRecruitmentEvent,
  type RecruitmentEventAgentState
} from "@/app/recruitment-event-agent/actions";

const initialRecruitmentEventAgentState: RecruitmentEventAgentState = { status: "idle" };

type ApplicationOption = { id: string; label: string };

export function RecruitmentEventAgentForm({ applications }: { applications: ApplicationOption[] }) {
  const [state, formAction] = useActionState(processRecruitmentEvent, initialRecruitmentEventAgentState);

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-4 rounded-3xl border border-line bg-white p-5 shadow-card">
        <div>
          <h2 className="text-lg font-semibold text-ink">粘贴招聘通知</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">支持手工粘贴邮件或短信；不会连接 Gmail 或读取邮箱。</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm text-slate-600">
            关联岗位
            <select required name="applicationId" defaultValue="" className="mt-2 w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-ink outline-none">
              <option value="" disabled>请选择关联申请</option>
              {applications.map((application) => <option key={application.id} value={application.id}>{application.label}</option>)}
            </select>
          </label>
          <Field label="邮件主题" name="subject" placeholder="例如：产品经理一面邀请" />
          <Field label="发件人" name="sender" placeholder="recruiting@example.com" />
          <label className="block text-sm text-slate-600">接收时间（可选）<input type="datetime-local" name="receivedAt" step={60} className="mt-2 w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-ink outline-none" /></label>
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
        <div className="flex justify-end"><SubmitButton disabled={applications.length === 0} /></div>
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

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return <button disabled={pending || disabled} className="rounded-2xl bg-ink px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-70">{pending ? "正在分析…" : "分析并准备 Proposal"}</button>;
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
          <ResultValue label="时间安排" value={scheduleText(extraction.schedule)} />
          <ResultValue label="方式" value={extraction.deliveryMode} />
          <ResultValue label="方式原文" value={extraction.deliveryModeRawText} />
          <ResultValue label="线上链接" value={extraction.onlineUrl} />
          <ResultValue label="线下地点" value={extraction.offlineAddress} />
          <ResultValue label="行动项" value={extraction.actions} />
          <ResultValue label="要求" value={extraction.requirements} />
        </dl>
        <details className="mt-4 rounded-2xl bg-panel p-4"><summary className="cursor-pointer text-sm font-medium text-ink">来源证据</summary><pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-700">{extraction.evidenceText}</pre></details>
      </section>

      <section className="rounded-3xl border border-line bg-white p-5 shadow-card">
        <h2 className="text-lg font-semibold text-ink">Proposal 结果</h2>
        {proposal.created ? <div className="mt-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800"><p>已为 {proposal.application.companyName} · {proposal.application.roleTitle} 创建待确认 Proposal：<span className="font-mono text-xs">{proposal.proposalId}</span></p><Link href="/proposals" className="mt-3 inline-flex rounded-xl bg-ink px-3 py-2 text-sm font-medium text-white">前往确认</Link></div> : <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">事件类型未知，未创建 Proposal。</p>}
      </section>
    </div>
  );
}

function ResultValue({ label, value }: { label: string; value: string | readonly string[] | null }) {
  const text = Array.isArray(value) ? value.join("；") : value;
  return <div><dt className="text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-ink">{text || "未知"}</dd></div>;
}

function scheduleText(schedule: NonNullable<RecruitmentEventAgentState["extraction"]>["schedule"]) {
  if (schedule.type === "FIXED_TIME") return schedule.startAt ? `固定时间：${schedule.startAt}` : "固定时间未提供";
  if (schedule.type === "TIME_WINDOW") return `有效时间：${schedule.startAt || "未提供"} 至 ${schedule.endAt || "未提供"}`;
  if (schedule.type === "DEADLINE") return schedule.endAt ? `截止时间：${schedule.endAt}` : "截止时间未提供";
  return "未知";
}
