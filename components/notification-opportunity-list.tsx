"use client";

import Link from "next/link";
import type { ApplicationStage } from "@prisma/client";
import { useRef, useState, useTransition } from "react";
import { reorderNotificationApplications } from "@/app/actions";
import { ApplicationStageBadge } from "@/components/application-stage-badge";

export type NotificationOpportunity = {
  id: string;
  companyName: string;
  roleTitle: string;
  stage: ApplicationStage;
  notificationCount: number;
};

export function NotificationOpportunityList({ initialOpportunities }: { initialOpportunities: NotificationOpportunity[] }) {
  const [opportunities, setOpportunities] = useState(initialOpportunities);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [targetPosition, setTargetPosition] = useState<"before" | "after">("before");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const didDragRef = useRef(false);

  function moveOpportunity(sourceId: string, targetId: string, position: "before" | "after") {
    if (sourceId === targetId) return;

    const previous = opportunities;
    const fromIndex = previous.findIndex((item) => item.id === sourceId);
    const toIndex = previous.findIndex((item) => item.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;

    const next = [...previous];
    const [dragged] = next.splice(fromIndex, 1);
    let insertIndex = toIndex - (fromIndex < toIndex ? 1 : 0);
    if (position === "after") insertIndex += 1;
    next.splice(insertIndex, 0, dragged);
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
    <div className="overflow-hidden rounded-xl border border-line bg-white" aria-busy={pending}>
      {opportunities.map((opportunity) => <div
        key={opportunity.id}
        draggable={!pending}
        onDragStart={(event) => {
          didDragRef.current = true;
          setDraggedId(opportunity.id);
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", opportunity.id);
        }}
        onDragEnd={() => {
          setDraggedId(null);
          setTargetId(null);
          setTargetPosition("before");
          window.setTimeout(() => { didDragRef.current = false; }, 0);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setTargetId(opportunity.id);
          const bounds = event.currentTarget.getBoundingClientRect();
          setTargetPosition(event.clientY > bounds.top + bounds.height / 2 ? "after" : "before");
        }}
        onDrop={(event) => {
          event.preventDefault();
          const sourceId = event.dataTransfer.getData("text/plain") || draggedId;
          if (sourceId) moveOpportunity(sourceId, opportunity.id, targetPosition);
          setDraggedId(null);
          setTargetId(null);
        }}
        className={`border-b last:border-b-0 transition ${draggedId === opportunity.id ? "border-slate-300 opacity-50" : targetId === opportunity.id ? `bg-slate-50 ${targetPosition === "before" ? "border-t-2 border-accent" : "border-b-2 border-accent"}` : "border-line hover:bg-slate-50"}`}
      >
        <Link href={`/notifications/${opportunity.id}`} onClick={(event) => { if (didDragRef.current) event.preventDefault(); }} className="flex min-h-[52px] items-center gap-3 px-4 py-2.5">
          <span aria-hidden="true" className="cursor-grab text-slate-400 active:cursor-grabbing">⠿</span>
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{opportunity.companyName} · {opportunity.roleTitle}</p>
          <ApplicationStageBadge stage={opportunity.stage} />
          <span className="shrink-0 text-xs text-slate-400">历史通知 {opportunity.notificationCount} 条</span>
          <span aria-hidden="true" className="shrink-0 text-slate-400">›</span>
        </Link>
      </div>)}
    </div>
  </>;
}
