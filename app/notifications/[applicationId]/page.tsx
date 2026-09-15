import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/app-shell";
import { EventTimeFields, EventTimeSummary } from "@/components/event-time-summary";
import { updateNotificationEvent } from "@/app/actions";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { requireSessionUser } from "@/lib/session";

const eventTypeOptions = [{ value: "NOTE", label: "备注" }, { value: "ASSESSMENT", label: "测评" }, { value: "INTERVIEW", label: "面试" }, { value: "OFFER", label: "录用" }, { value: "REJECTION", label: "拒绝" }, { value: "DEADLINE", label: "截止时间" }] as const;

export default async function NotificationTimelinePage({ params }: { params: Promise<{ applicationId: string }> }) {
  const user = await requireSessionUser();
  const { applicationId } = await params;
  const application = await prisma.application.findFirst({ where: { id: applicationId, jobLead: { ownerId: user.id } }, include: { jobLead: { select: { companyName: true, roleTitle: true } }, events: { orderBy: [{ eventTime: "desc" }, { createdAt: "desc" }] } } });
  if (!application) notFound();
  const events = application.events.sort((left, right) => notificationTimestamp(right) - notificationTimestamp(left));

  return <PageShell title={`${application.jobLead.companyName} | ${application.jobLead.roleTitle}`} description={`通知时间线 · 共 ${events.length} 条`} action={<Link href="/notifications" className="inline-flex rounded-2xl border border-line px-4 py-3 text-sm font-medium text-ink">返回通知列表</Link>}>
    <div className="space-y-3">
      {events.length === 0 ? <div className="rounded-3xl border border-line bg-white p-6 text-sm text-slate-500 shadow-card">还没有通知记录。</div> : events.map((event) => {
        const details = readEventDetails(event.detailsJson);
        return <details key={event.id} className="group rounded-3xl border border-line bg-white shadow-card"><summary className="list-none cursor-pointer p-4"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500"><span>{getEventTypeLabel(event.eventType)}</span><span>记录于 {formatDate(event.createdAt)}</span></div><div className="mt-1"><EventTimeSummary {...event} /></div><h2 className="mt-1 truncate text-lg font-semibold text-ink">{event.title}</h2><p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{notificationSummary(event.title, details.content)}</p></div><span className="shrink-0 rounded-full border border-line px-3 py-1 text-xs text-slate-500">展开</span></div></summary>
          <div className="border-t border-line px-4 pb-4 pt-4"><div className="whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{details.content || "未保存通知正文。"}</div><form action={updateNotificationEvent} className="mt-3 space-y-3 rounded-3xl border border-line bg-slate-50 p-4"><input type="hidden" name="eventId" value={event.id} /><div className="grid gap-3 md:grid-cols-2"><label className="block text-sm text-slate-600">通知类型<select name="eventType" defaultValue={event.eventType} className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none">{eventTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div><EventTimeFields defaultValues={event} /><label className="block text-sm text-slate-600">标题<input name="title" defaultValue={event.title} className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none" /></label><label className="block text-sm text-slate-600">通知正文<textarea name="content" rows={5} defaultValue={details.content} className="mt-2 w-full rounded-3xl border border-line bg-white px-4 py-3 outline-none" /></label><label className="block text-sm text-slate-600">要求事项 / 后续动作<textarea name="requirementsText" rows={4} defaultValue={details.requirements.join("\n")} className="mt-2 w-full rounded-3xl border border-line bg-white px-4 py-3 outline-none" placeholder="每行一条" /></label>{event.artifactUrl ? <a href={event.artifactUrl} target="_blank" className="block text-sm text-accent underline-offset-4 hover:underline">{event.artifactName || "打开附件"}</a> : null}<button className="w-full rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-white">保存通知</button></form></div>
        </details>;
      })}
    </div>
  </PageShell>;
}

function getEventTypeLabel(eventType: string) { return eventTypeOptions.find((option) => option.value === eventType)?.label ?? eventType; }
function readEventDetails(detailsJson: string) { try { const parsed = JSON.parse(detailsJson) as { content?: unknown; requirements?: unknown }; return { content: typeof parsed.content === "string" ? parsed.content : "", requirements: Array.isArray(parsed.requirements) ? parsed.requirements.filter((item): item is string => typeof item === "string") : [] as string[] }; } catch { return { content: "", requirements: [] as string[] }; } }
function notificationSummary(title: string, content: string) { return title.trim() || content.replace(/\s+/g, " ").trim().slice(0, 160) || "通知详情待补充"; }
function notificationTimestamp(event: { eventTime: Date | null; createdAt: Date }) { return (event.eventTime || event.createdAt).getTime(); }
