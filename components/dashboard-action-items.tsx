"use client";

import Link from "next/link";
import { useState } from "react";
import { closeDashboardApplication, updateDashboardEventStatus } from "@/app/actions";
import { Panel } from "@/components/cards";
import type { DashboardWorkflowItem } from "@/lib/workflow";

export function DashboardActionItems({ initialItems }: { initialItems: DashboardWorkflowItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function updateEvent(item: DashboardWorkflowItem, status: "COMPLETED" | "IGNORED") {
    if (!item.eventId) return;
    setOpenItemId(null);
    setError(null);
    try {
      await updateDashboardEventStatus(item.eventId, status);
      setItems((current) => current.filter((currentItem) => currentItem.eventId !== item.eventId));
    } catch {
      setError("更新事项状态失败，请稍后重试。");
    }
  }

  async function closeApplication(item: DashboardWorkflowItem) {
    setOpenItemId(null);
    setError(null);
    try {
      await closeDashboardApplication(item.applicationId);
      setItems((current) => current.filter((currentItem) => currentItem.applicationId !== item.applicationId));
    } catch {
      setError("放弃该岗位失败，请稍后重试。");
    }
  }

  return <Panel title={`今天有 ${items.length} 件事需要处理`} subtitle="今日 / 即将到期">
    {error ? <p role="alert" className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
    <div className="divide-y divide-line">
      {items.length === 0 ? <div className="rounded-2xl bg-panel p-4 text-sm text-slate-500">目前没有临近的待办或安排。</div> : items.map((item) => (
        <div key={item.id} className="flex items-center gap-2 py-3 first:pt-0 last:pb-0">
          <Link href={item.href} className="flex min-w-0 flex-1 items-center justify-between gap-4 transition hover:text-accent">
            <p className="min-w-0 truncate text-sm text-ink"><span className="font-medium">{item.companyName}</span>：{item.reason}</p>
            <span className="shrink-0 text-xs text-slate-400">{item.displayTime}</span>
          </Link>
          {item.sourceType === "EVENT" ? <div className="relative shrink-0">
            <button type="button" aria-label={`处理${item.companyName}事项`} aria-expanded={openItemId === item.id} onClick={() => setOpenItemId((current) => current === item.id ? null : item.id)} className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">···</button>
            {openItemId === item.id ? <div className="absolute right-0 top-8 z-10 w-40 rounded-xl border border-line bg-white p-1 text-sm shadow-card">
              <button type="button" onClick={() => void updateEvent(item, "COMPLETED")} className="w-full rounded-lg px-3 py-2 text-left text-slate-700 hover:bg-emerald-50">✓ 标记已完成</button>
              <button type="button" onClick={() => void updateEvent(item, "IGNORED")} className="w-full rounded-lg px-3 py-2 text-left text-slate-700 hover:bg-slate-50">⊘ 忽略此事项</button>
              <div className="my-1 border-t border-line" />
              <button type="button" onClick={() => void closeApplication(item)} className="w-full rounded-lg px-3 py-2 text-left text-rose-700 hover:bg-rose-50">放弃该岗位</button>
            </div> : null}
          </div> : null}
        </div>
      ))}
    </div>
  </Panel>;
}
