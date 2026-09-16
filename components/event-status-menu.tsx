"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateEventStatus } from "@/app/actions";

type EventStatus = "ACTIVE" | "COMPLETED" | "IGNORED";

export function EventStatusBadge({ status }: { status: EventStatus }) {
  const labels = { ACTIVE: "待处理", COMPLETED: "✓ 已完成", IGNORED: "已忽略" } as const;
  const styles = { ACTIVE: "border-line text-slate-500", COMPLETED: "border-slate-200 bg-slate-50 text-slate-400", IGNORED: "border-slate-100 bg-slate-50 text-slate-300" } as const;
  return <span className={`shrink-0 rounded-full border px-3 py-1 text-xs ${styles[status]}`}>{labels[status]}</span>;
}

export function EventStatusMenu({ eventId, status }: { eventId: string; status: EventStatus }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function updateStatus(nextStatus: EventStatus) {
    setOpen(false);
    setError(null);
    startTransition(async () => {
      try {
        await updateEventStatus(eventId, nextStatus);
        router.refresh();
      } catch {
        setError("更新通知状态失败，请稍后重试。");
      }
    });
  }

  return <div className="relative">
    <button type="button" aria-label="处理通知状态" aria-expanded={open} disabled={pending} onClick={() => setOpen((current) => !current)} className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50">···</button>
    {open ? <div className="absolute right-0 top-8 z-10 w-40 rounded-xl border border-line bg-white p-1 text-sm shadow-card">
      {status === "ACTIVE" ? <><button type="button" onClick={() => updateStatus("COMPLETED")} className="w-full rounded-lg px-3 py-2 text-left text-slate-700 hover:bg-emerald-50">✓ 标记已完成</button><button type="button" onClick={() => updateStatus("IGNORED")} className="w-full rounded-lg px-3 py-2 text-left text-slate-700 hover:bg-slate-50">⊘ 忽略此事项</button></> : <button type="button" onClick={() => updateStatus("ACTIVE")} className="w-full rounded-lg px-3 py-2 text-left text-slate-700 hover:bg-slate-50">恢复为待处理</button>}
    </div> : null}
    {error ? <p role="alert" className="absolute right-0 top-10 z-20 w-56 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p> : null}
  </div>;
}
