"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { reorderNotificationApplications } from "@/app/actions";

export type NotificationOpportunity = {
  id: string;
  companyName: string;
  roleTitle: string;
  stageLabel: string;
  notificationCount: number;
};

export function NotificationOpportunityList({ initialOpportunities }: { initialOpportunities: NotificationOpportunity[] }) {
  const [opportunities, setOpportunities] = useState(initialOpportunities);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function moveOpportunity(targetId: string) {
    if (!draggedId || draggedId === targetId) return;

    const previous = opportunities;
    const fromIndex = previous.findIndex((item) => item.id === draggedId);
    const toIndex = previous.findIndex((item) => item.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;

    const next = [...previous];
    const [dragged] = next.splice(fromIndex, 1);
    next.splice(fromIndex < toIndex ? toIndex - 1 : toIndex, 0, dragged);
    setOpportunities(next);
    setError(null);
    startTransition(async () => {
      try {
        await reorderNotificationApplications(next.map((item) => item.id));
      } catch {
        setOpportunities(previous);
        setError("保存排序失败，已恢复原顺序。");
      }
    });
  }

  return <>
    {error ? <p role="alert" className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
    <div className="space-y-2" aria-busy={pending}>
      {opportunities.map((opportunity) => <div key={opportunity.id} draggable={!pending} onDragStart={(event) => { setDraggedId(opportunity.id); event.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => { setDraggedId(null); setTargetId(null); }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setTargetId(opportunity.id); }} onDrop={(event) => { event.preventDefault(); moveOpportunity(opportunity.id); setDraggedId(null); setTargetId(null); }} className={`rounded-2xl border bg-white transition ${draggedId === opportunity.id ? "border-slate-300 opacity-50" : targetId === opportunity.id ? "border-accent bg-slate-50" : "border-line hover:bg-slate-50"}`}>
        <Link href={`/notifications/${opportunity.id}`} className="flex min-h-14 items-center gap-3 px-4 py-3">
          <span aria-hidden="true" className="cursor-grab text-slate-400 active:cursor-grabbing">⠿</span>
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{opportunity.companyName} · {opportunity.roleTitle}</p>
          <span className="shrink-0 text-xs text-slate-500">{opportunity.stageLabel}</span>
          <span className="shrink-0 text-xs text-slate-400">历史通知 {opportunity.notificationCount} 条</span>
          <span aria-hidden="true" className="shrink-0 text-slate-400">›</span>
        </Link>
      </div>)}
    </div>
  </>;
}
