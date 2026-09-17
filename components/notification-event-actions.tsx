"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { deleteNotificationEvent, updateEventStatus } from "@/app/actions";
import { NotificationEventEditDialog, type NotificationEventForEdit } from "@/components/notification-event-edit-dialog";

type EventStatus = "ACTIVE" | "COMPLETED" | "IGNORED";
type ApplicationOption = { id: string; label: string };

export function NotificationEventActions({
  event,
  status,
  applications,
}: {
  event: NotificationEventForEdit;
  status: EventStatus;
  applications: ApplicationOption[];
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function updateStatus(nextStatus: EventStatus) {
    setOpen(false);
    setError(null);
    startTransition(async () => {
      try {
        await updateEventStatus(event.id, nextStatus);
        router.refresh();
      } catch {
        setError("更新通知状态失败，请稍后重试。");
      }
    });
  }

  function deleteEvent() {
    setError(null);
    startTransition(async () => {
      try {
        await deleteNotificationEvent(event.id);
        setConfirmingDelete(false);
        router.refresh();
      } catch {
        setError("删除通知失败，请稍后重试。");
      }
    });
  }

  return <>
    <div className="relative" onClick={(event) => event.stopPropagation()}>
      <button type="button" aria-label="更多通知操作" aria-expanded={open} disabled={pending} onClick={() => setOpen((current) => !current)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-base font-semibold tracking-widest text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50">···</button>
      {open ? <div className="absolute right-0 top-8 z-10 w-44 rounded-xl border border-line bg-white p-1 text-sm shadow-card">
        <button type="button" onClick={() => { setOpen(false); setEditing(true); }} className="w-full rounded-lg px-3 py-2 text-left text-slate-700 hover:bg-slate-50">编辑</button>
        <div className="my-1 border-t border-line" />
        {status === "ACTIVE" ? <>
          <button type="button" onClick={() => updateStatus("COMPLETED")} className="w-full rounded-lg px-3 py-2 text-left text-slate-700 hover:bg-emerald-50">✓ 标记已完成</button>
          <button type="button" onClick={() => updateStatus("IGNORED")} className="w-full rounded-lg px-3 py-2 text-left text-slate-700 hover:bg-slate-50">⊘ 忽略此事项</button>
        </> : <button type="button" onClick={() => updateStatus("ACTIVE")} className="w-full rounded-lg px-3 py-2 text-left text-slate-700 hover:bg-slate-50">恢复为待处理</button>}
        <div className="my-1 border-t border-line" />
        <button type="button" onClick={() => { setOpen(false); setConfirmingDelete(true); }} className="w-full rounded-lg px-3 py-2 text-left text-rose-700 hover:bg-rose-50">删除通知</button>
      </div> : null}
      {error ? <p role="alert" className="absolute right-0 top-10 z-20 w-56 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p> : null}
    </div>

    {editing ? <NotificationEventEditDialog event={event} applications={applications} onClose={() => setEditing(false)} /> : null}

    {confirmingDelete ? createPortal(
      <div className="fixed inset-0 z-[110] bg-slate-950/30 p-4 backdrop-blur-sm" role="presentation" onClick={() => !pending && setConfirmingDelete(false)}>
        <div className="flex min-h-full items-center justify-center">
          <section role="dialog" aria-modal="true" aria-labelledby="delete-notification-title" className="w-full max-w-md rounded-3xl border border-line bg-white p-5 shadow-card" onClick={(clickEvent) => clickEvent.stopPropagation()}>
            <h2 id="delete-notification-title" className="text-lg font-semibold text-ink">删除这条通知？</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">只删除当前通知，不会删除岗位或该岗位的其他通知。此操作不可撤销。</p>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" disabled={pending} onClick={() => setConfirmingDelete(false)} className="rounded-2xl border border-line px-4 py-3 text-sm font-medium text-ink disabled:opacity-50">取消</button>
              <button type="button" disabled={pending} onClick={deleteEvent} className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50">{pending ? "正在删除..." : "删除通知"}</button>
            </div>
          </section>
        </div>
      </div>,
      document.body
    ) : null}
  </>;
}
