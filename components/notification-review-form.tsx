"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { updateNotificationEvent } from "@/app/actions";
import { EventTimeFields } from "@/components/event-time-summary";
import { notificationEventTypeOptions } from "@/lib/event-types";

type ReviewEvent = {
  id: string; applicationId: string; eventType: string; status: "ACTIVE" | "COMPLETED" | "IGNORED"; title: string;
  eventTime: string | null; windowStartAt: string | null; deadlineAt: string | null; receivedAt: string | null; relativeValidityMinutes: number | null; detailsJson: string;
};
type ApplicationOption = { id: string; label: string };
const initialState = { status: "idle" as const };

export function NotificationReviewForm({ event, applications }: { event: ReviewEvent; applications: ApplicationOption[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [dirty, setDirty] = useState(false);
  const [state, formAction, pending] = useActionState(updateNotificationEvent, initialState);
  const details = readDetails(event.detailsJson);

  useEffect(() => {
    if (state.status !== "success" || !state.applicationId) return;
    router.replace(`/notifications/${state.applicationId}`);
  }, [router, state]);

  return <div className="mx-auto max-w-3xl rounded-3xl border border-line bg-white p-5 shadow-card">
    <form ref={formRef} action={formAction} onChange={() => setDirty(true)} className="space-y-4">
      <input type="hidden" name="eventId" value={event.id} />
      <label className="block text-sm text-slate-600">关联岗位
        <select name="applicationId" defaultValue={event.applicationId} className="mt-2 w-full rounded-2xl border border-line bg-panel px-4 py-3 outline-none">
          {applications.map((application) => <option key={application.id} value={application.id}>{application.label}</option>)}
        </select>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-slate-600">通知类型
          <select name="eventType" defaultValue={event.eventType} className="mt-2 w-full rounded-2xl border border-line bg-panel px-4 py-3 outline-none">
            {notificationEventTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="block text-sm text-slate-600">状态
          <select name="status" defaultValue={event.status} className="mt-2 w-full rounded-2xl border border-line bg-panel px-4 py-3 outline-none">
            <option value="ACTIVE">待处理</option><option value="COMPLETED">已完成</option><option value="IGNORED">已忽略</option>
          </select>
        </label>
      </div>
      <label className="block text-sm text-slate-600">标题
        <input name="title" required defaultValue={event.title} className="mt-2 w-full rounded-2xl border border-line bg-panel px-4 py-3 outline-none" />
      </label>
      <EventTimeFields defaultValues={event} />
      <label className="block text-sm text-slate-600">要求事项 / 后续动作
        <textarea name="requirementsText" rows={3} defaultValue={details.requirements.join("\n")} placeholder="每行一条" className="mt-2 w-full rounded-3xl border border-line bg-panel px-4 py-3 outline-none" />
      </label>
      <label className="block text-sm text-slate-600">通知内容
        <textarea name="content" rows={10} defaultValue={details.content} className="mt-2 w-full rounded-3xl border border-line bg-panel px-4 py-3 outline-none" />
      </label>
      {state.status === "error" ? <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{state.message || "保存通知失败，请稍后重试。"}</p> : null}
      <div className="flex justify-end"><button disabled={pending} className="rounded-2xl bg-ink px-5 py-3 text-sm font-medium text-white disabled:opacity-70">{pending ? "正在保存..." : "保存并确认"}</button></div>
    </form>
    <NotificationReviewLeaveGuard dirty={dirty} pending={pending} />
  </div>;
}

function NotificationReviewLeaveGuard({ dirty, pending }: { dirty: boolean; pending: boolean }) {
  const router = useRouter();
  const [destination, setDestination] = useState<string | "back" | null>(null);
  const bypassBackRef = useRef(false);
  useEffect(() => {
    if (!dirty || destination) return;
    window.history.pushState({ notificationReviewGuard: true }, "", window.location.href);
    const onBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const onPopState = () => { if (!bypassBackRef.current) { window.history.go(1); setDestination("back"); } };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin === window.location.origin && url.pathname !== window.location.pathname) { event.preventDefault(); setDestination(`${url.pathname}${url.search}${url.hash}`); }
    };
    window.addEventListener("beforeunload", onBeforeUnload); window.addEventListener("popstate", onPopState); document.addEventListener("click", onClick, true);
    return () => { window.removeEventListener("beforeunload", onBeforeUnload); window.removeEventListener("popstate", onPopState); document.removeEventListener("click", onClick, true); };
  }, [destination, dirty]);
  if (!destination) return null;
  return <div role="dialog" aria-modal="true" aria-labelledby="notification-review-leave-title" className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-3xl border border-line bg-white p-5 shadow-card"><h2 id="notification-review-leave-title" className="text-lg font-semibold text-ink">这条通知还没有完成确认，是否离开？</h2><div className="mt-5 flex justify-end gap-3"><button type="button" disabled={pending} onClick={() => setDestination(null)} className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-ink">继续检查</button><button type="button" disabled={pending} onClick={() => { if (destination === "back") { bypassBackRef.current = true; window.history.back(); } else router.push(destination); }} className="rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white">离开</button></div></div></div>;
}

function readDetails(value: string) {
  try {
    const parsed = JSON.parse(value) as { content?: unknown; requirements?: unknown };
    return { content: typeof parsed.content === "string" ? parsed.content : "", requirements: Array.isArray(parsed.requirements) ? parsed.requirements.filter((item): item is string => typeof item === "string") : [] };
  } catch { return { content: "", requirements: [] as string[] }; }
}
