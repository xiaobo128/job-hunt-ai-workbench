"use client";

import { useActionState, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { confirmRecruitmentEventProposalAction } from "@/app/proposals/actions";
import { processRecruitmentEvent, type RecruitmentEventAgentState } from "@/app/recruitment-event-agent/actions";
import { getEventTypeLabel } from "@/lib/event-types";

const initialState: RecruitmentEventAgentState = { status: "idle" };

export function AddNotificationDialog() {
  const [open, setOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDialogKey((value) => value + 1);
          setOpen(true);
        }}
        className="inline-flex rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-white"
      >
        导入通知
      </button>

      {open
        ? createPortal(
            <div className="fixed inset-0 z-[100] bg-slate-950/30 p-4 backdrop-blur-sm sm:p-6">
              <div className="flex min-h-full items-center justify-center">
                <ImportNotificationForm key={dialogKey} onClose={() => setOpen(false)} />
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

function ImportNotificationForm({ onClose }: { onClose: () => void }) {
  const [state, formAction] = useActionState(processRecruitmentEvent, initialState);

  return <section role="dialog" aria-modal="true" aria-labelledby="import-notification-title" className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-line bg-white p-5 shadow-card sm:max-h-[calc(100vh-3rem)]">
    <div className="flex items-start justify-between gap-4"><div><h2 id="import-notification-title" className="text-lg font-semibold text-ink">导入通知</h2><p className="mt-1 text-sm leading-6 text-slate-500">粘贴招聘邮件或通知内容。系统会识别关键信息并找到对应的求职记录，供你确认后写入通知历史。</p></div><button type="button" onClick={onClose} aria-label="关闭" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-line text-xl leading-none text-slate-500">×</button></div>

    <form action={formAction} className="mt-5 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2"><ImportField label="邮件主题（可选）" name="subject" placeholder="例如：产品经理一面邀请" /><ImportField label="发件人（可选）" name="sender" placeholder="recruiting@example.com" /><ImportField label="接收时间（可选）" name="receivedAt" placeholder="2026-09-25T09:30:00+08:00" /></div>
      <label className="block text-sm text-slate-600">通知内容<textarea required name="content" rows={12} className="mt-2 w-full rounded-3xl border border-line bg-panel px-4 py-3 text-sm leading-6 text-ink outline-none" placeholder="例如：请于 2026-04-26 19:00 参加面试，并提前准备作品集。" /></label>
      {state.status === "error" ? <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{state.message || "解析通知失败，请稍后重试。"}</p> : null}
      {state.status === "success" ? <ImportResult state={state} /> : null}
      <div className="flex flex-wrap justify-end gap-3"><button type="button" onClick={onClose} className="rounded-2xl border border-line px-4 py-3 text-sm font-medium text-ink">取消</button>{state.status === "success" ? <SubmitButton label="重新解析" secondary /> : <SubmitButton label="开始解析" />}{state.status === "success" && state.proposal?.created ? <ConfirmNotificationButton proposalId={state.proposal.proposalId} /> : null}</div>
    </form>
  </section>;
}

function ImportField({ label, name, placeholder }: { label: string; name: string; placeholder: string }) {
  return <label className="block text-sm text-slate-600">{label}<input name={name} className="mt-2 w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-ink outline-none" placeholder={placeholder} /></label>;
}

function ImportResult({ state }: { state: RecruitmentEventAgentState }) {
  const extraction = state.extraction;
  const result = state.proposal;
  if (!extraction || !result) return null;

  if (!result.created) {
    if (result.reason === "UNKNOWN_EVENT_TYPE") {
      return <section className="rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900"><h3 className="font-medium">暂时无法识别通知类型</h3><p className="mt-1">请检查通知内容后重新解析。</p></section>;
    }

    if (!result.candidates.length) {
      return <section className="rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900"><h3 className="font-medium">暂时无法找到对应的求职记录</h3></section>;
    }

    return <section className="rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-950"><h3 className="font-medium">请选择对应的求职记录</h3><p className="mt-1 text-amber-800">通知中没有足够信息唯一确认岗位，请手动选择正确的申请。</p><div className="mt-3 space-y-2">{result.candidates.map((candidate) => <article key={candidate.applicationId} className="rounded-2xl border border-amber-200 bg-white p-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium text-ink">{candidate.companyName} · {candidate.roleTitle}</p><p className="mt-1 text-xs text-slate-500">匹配置信度 {candidate.confidence} · 分数 {candidate.score}</p></div><button type="submit" name="selectedApplicationId" value={candidate.applicationId} formNoValidate className="rounded-xl bg-ink px-3 py-2 text-xs font-medium text-white">选择此申请</button></div></article>)}</div></section>;
  }

  return <section className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-950"><h3 className="font-medium">已识别通知信息</h3><dl className="mt-3 grid gap-3 sm:grid-cols-2"><ResultField label="公司" value={result.match.companyName} /><ResultField label="岗位" value={result.match.roleTitle} /><ResultField label="通知类型" value={getEventTypeLabel(extraction.eventType)} /><ScheduleResult schedule={extraction.schedule} /><ResultField label="方式" value={deliveryModeLabel(extraction.deliveryMode)} /><ResultField label="下一步行动" value={extraction.actions?.join("；") || null} />{extraction.onlineUrl ? <div><dt className="text-xs font-medium text-emerald-800">链接</dt><dd className="mt-1"><a href={extraction.onlineUrl} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-4">打开会议链接</a></dd></div> : null}</dl></section>;
}

function ResultField({ label, value }: { label: string; value: string | null }) {
  return <div><dt className="text-xs font-medium text-emerald-800">{label}</dt><dd className="mt-1 leading-6 text-emerald-950">{value || "未提供"}</dd></div>;
}

function ScheduleResult({ schedule }: { schedule: NonNullable<RecruitmentEventAgentState["extraction"]>["schedule"] }) {
  if (schedule.type === "FIXED_TIME") return <ResultField label="固定时间" value={formatNotificationTime(schedule.startAt)} />;
  if (schedule.type === "TIME_WINDOW") return <ResultField label="有效时间" value={`${formatNotificationTime(schedule.startAt) || "未提供"} 至 ${formatNotificationTime(schedule.endAt) || "未提供"}`} />;
  if (schedule.type === "DEADLINE") return <ResultField label="截止时间" value={formatNotificationTime(schedule.endAt)} />;
  return null;
}

function deliveryModeLabel(value: string) {
  return value === "ONLINE" ? "线上" : value === "OFFLINE" ? "线下" : value === "HYBRID" ? "线上和线下" : "未提供";
}

function formatNotificationTime(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function SubmitButton({ label, secondary = false }: { label: string; secondary?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      disabled={pending}
      className={`rounded-2xl px-5 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-70 ${secondary ? "border border-line text-ink" : "bg-ink text-white"}`}
    >
      {pending ? "正在 AI 解析…" : label}
    </button>
  );
}

function ConfirmNotificationButton({ proposalId }: { proposalId: string }) {
  const { pending } = useFormStatus();

  return (
    <>
      <input type="hidden" name="proposalId" value={proposalId} />
      <button
        formAction={confirmRecruitmentEventProposalAction}
        formNoValidate
        disabled={pending}
        className="rounded-2xl bg-ink px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? "正在写入通知…" : "确认通知信息"}
      </button>
    </>
  );
}
