"use client";

import { useActionState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { updateNotificationEvent } from "@/app/actions";
import { EventTimeFields } from "@/components/event-time-summary";
import { notificationEventTypeOptions } from "@/lib/event-types";

type ApplicationOption = {
  id: string;
  label: string;
};

export type NotificationEventForEdit = {
  id: string;
  applicationId: string;
  eventType: string;
  status?: "ACTIVE" | "COMPLETED" | "IGNORED";
  title: string;
  eventTime: string | null;
  windowStartAt: string | null;
  deadlineAt: string | null;
  receivedAt: string | null;
  relativeValidityMinutes: number | null;
  content: string;
  requirements: string[];
  artifactName: string | null;
  artifactUrl: string | null;
};

const initialState = { status: "idle" as const };

export function NotificationEventEditDialog({
  event,
  applications,
  onClose,
}: {
  event: NotificationEventForEdit;
  applications: ApplicationOption[];
  onClose: () => void;
}) {
  const [state, formAction] = useActionState(updateNotificationEvent, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.status !== "success") return;

    onClose();
    if (state.applicationId && state.applicationId !== event.applicationId) {
      router.replace(`/notifications/${state.applicationId}`);
    }
    router.refresh();
  }, [event.applicationId, onClose, router, state]);

  useEffect(() => {
    const closeOnEscape = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-slate-950/30 p-4 backdrop-blur-sm sm:p-6" role="presentation" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center">
        <section role="dialog" aria-modal="true" aria-labelledby="edit-notification-title" className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-line bg-white p-5 shadow-card sm:max-h-[calc(100vh-3rem)]" onClick={(clickEvent) => clickEvent.stopPropagation()}>
          <header className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-ink" id="edit-notification-title">编辑通知</div>
              <p className="mt-1 text-sm text-slate-500">修改关联、通知摘要或保存的原始邮件正文。</p>
            </div>
            <button type="button" onClick={onClose} aria-label="关闭" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-line text-xl leading-none text-slate-500">×</button>
          </header>

          <form action={formAction} className="mt-5 space-y-4">
            <input type="hidden" name="eventId" value={event.id} />

            <label className="block text-sm text-slate-600">
              关联岗位
              <select name="applicationId" defaultValue={event.applicationId} className="mt-2 w-full rounded-2xl border border-line bg-panel px-4 py-3 outline-none">
                {applications.map((application) => <option key={application.id} value={application.id}>{application.label}</option>)}
              </select>
            </label>

            <label className="block text-sm text-slate-600">
              状态
              <select name="status" defaultValue={event.status ?? "ACTIVE"} className="mt-2 w-full rounded-2xl border border-line bg-panel px-4 py-3 outline-none">
                <option value="ACTIVE">待处理</option><option value="COMPLETED">已完成</option><option value="IGNORED">已忽略</option>
              </select>
            </label>

            <label className="block text-sm text-slate-600">
              通知类型
              <select name="eventType" defaultValue={event.eventType} className="mt-2 w-full rounded-2xl border border-line bg-panel px-4 py-3 outline-none">
                {notificationEventTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <label className="block text-sm text-slate-600">
              标题
              <input name="title" defaultValue={event.title} required className="mt-2 w-full rounded-2xl border border-line bg-panel px-4 py-3 outline-none" />
            </label>

            <EventTimeFields defaultValues={event} />

            <label className="block text-sm text-slate-600">
              要求事项 / 后续动作
              <textarea name="requirementsText" rows={3} defaultValue={event.requirements.join("\n")} className="mt-2 w-full rounded-3xl border border-line bg-panel px-4 py-3 outline-none" placeholder="每行一条" />
            </label>

            <label className="block text-sm text-slate-600">
              原始邮件正文
              <p className="mt-1 text-xs leading-5 text-slate-500">编辑原文不会自动更新通知摘要。</p>
              <textarea name="content" rows={12} defaultValue={event.content} className="mt-2 w-full rounded-3xl border border-line bg-panel px-4 py-3 outline-none" />
            </label>

            {event.artifactUrl ? <a href={event.artifactUrl} target="_blank" rel="noreferrer" className="block text-sm text-accent underline-offset-4 hover:underline">{event.artifactName || "打开附件"}</a> : null}

            {state.status === "error" ? <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{state.message || "保存通知失败，请稍后重试。"}</p> : null}

            <div className="flex justify-end gap-3">
              <button type="button" onClick={onClose} className="rounded-2xl border border-line px-4 py-3 text-sm font-medium text-ink">取消</button>
              <SubmitButton />
            </div>
          </form>
        </section>
      </div>
    </div>,
    document.body
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="rounded-2xl bg-ink px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-70">{pending ? "正在保存..." : "保存通知"}</button>;
}
