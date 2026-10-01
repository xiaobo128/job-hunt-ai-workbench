"use client";

import { useActionState, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { confirmRecruitmentEventProposalAction } from "@/app/proposals/actions";
import { processRecruitmentEvent, type RecruitmentEventAgentState } from "@/app/recruitment-event-agent/actions";
import { getEventTypeLabel } from "@/lib/event-types";

const initialState: RecruitmentEventAgentState = { status: "idle" };

type ApplicationOption = { id: string; label: string };

export function AddNotificationDialog({ applications }: { applications: ApplicationOption[] }) {
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
                <ImportNotificationForm key={dialogKey} applications={applications} onClose={() => setOpen(false)} />
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

function ImportNotificationForm({ applications, onClose }: { applications: ApplicationOption[]; onClose: () => void }) {
  const [state, formAction] = useActionState(processRecruitmentEvent, initialState);

  return <section role="dialog" aria-modal="true" aria-labelledby="import-notification-title" className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-line bg-white p-5 shadow-card sm:max-h-[calc(100vh-3rem)]">
    <div className="flex items-start justify-between gap-4"><div><h2 id="import-notification-title" className="text-lg font-semibold text-ink">导入通知</h2><p className="mt-1 text-sm leading-6 text-slate-500">先选择关联岗位，再粘贴招聘邮件或通知内容。AI 只负责提取通知信息，确认后写入所选岗位。</p></div><button type="button" onClick={onClose} aria-label="关闭" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-line text-xl leading-none text-slate-500">×</button></div>

    <form action={formAction} className="mt-5 space-y-4">
      <label className="block text-sm text-slate-600">关联岗位<span className="ml-1 text-rose-600">*</span><select required name="applicationId" defaultValue="" className="mt-2 w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-ink outline-none"><option value="" disabled>请选择关联申请</option>{applications.map((application) => <option key={application.id} value={application.id}>{application.label}</option>)}</select></label>
      {applications.length === 0 ? <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">当前没有可关联的有效申请，请先创建或恢复一个申请。</p> : null}
      <div className="grid gap-4 sm:grid-cols-2"><ImportField label="邮件主题（可选）" name="subject" placeholder="例如：产品经理一面邀请" /><ImportField label="发件人（可选）" name="sender" placeholder="recruiting@example.com" /><ReceivedAtField /></div>
      <label className="block text-sm text-slate-600">通知内容<textarea required name="content" rows={12} className="mt-2 w-full rounded-3xl border border-line bg-panel px-4 py-3 text-sm leading-6 text-ink outline-none" placeholder="例如：请于 2026-04-26 19:00 参加面试，并提前准备作品集。" /></label>
      {state.status === "error" ? <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{state.message || "解析通知失败，请稍后重试。"}</p> : null}
      {state.status === "success" ? <ImportResult state={state} /> : null}
      <div className="flex flex-wrap justify-end gap-3"><button type="button" onClick={onClose} className="rounded-2xl border border-line px-4 py-3 text-sm font-medium text-ink">取消</button>{state.status === "success" ? <SubmitButton label="重新解析" secondary /> : <SubmitButton label="开始解析" disabled={applications.length === 0} />}{state.status === "success" && state.proposal?.created ? <ConfirmNotificationButton proposalId={state.proposal.proposalId} /> : null}</div>
    </form>
  </section>;
}

function ImportField({ label, name, placeholder }: { label: string; name: string; placeholder: string }) {
  return <label className="block text-sm text-slate-600">{label}<input name={name} className="mt-2 w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-ink outline-none" placeholder={placeholder} /></label>;
}

function ReceivedAtField() {
  return <label className="block text-sm text-slate-600">接收时间（可选）<input type="datetime-local" name="receivedAt" step={60} className="mt-2 w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-ink outline-none" /></label>;
}

function ImportResult({ state }: { state: RecruitmentEventAgentState }) {
  const extraction = state.extraction;
  const result = state.proposal;
  if (!extraction || !result) return null;

  if (!result.created) {
    return <section className="rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900"><h3 className="font-medium">暂时无法识别通知类型</h3><p className="mt-1">请检查通知内容后重新解析。</p></section>;
  }

  return <section className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-950"><h3 className="font-medium">已识别通知信息</h3><dl className="mt-3 grid gap-3 sm:grid-cols-2"><ResultField label="关联岗位" value={`${result.application.companyName} · ${result.application.roleTitle}`} /><ResultField label="通知类型" value={getEventTypeLabel(extraction.eventType)} /><ScheduleResult schedule={extraction.schedule} /><ResultField label="方式" value={deliveryModeLabel(extraction.deliveryMode)} /><ResultField label="后续动作（原文摘录）" value={extraction.actions?.join("；") || null} /><ResultField label="要求事项（原文摘录）" value={extraction.requirements?.join("；") || null} />{extraction.onlineUrl ? <div><dt className="text-xs font-medium text-emerald-800">链接</dt><dd className="mt-1"><a href={extraction.onlineUrl} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-4">打开会议链接</a></dd></div> : null}{extraction.offlineAddress ? <ResultField label="线下地点" value={extraction.offlineAddress} /> : null}</dl></section>;
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

function SubmitButton({ label, secondary = false, disabled = false }: { label: string; secondary?: boolean; disabled?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      disabled={pending || disabled}
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
