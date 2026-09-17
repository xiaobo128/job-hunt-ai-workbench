import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/app-shell";
import { EventTimeSummary } from "@/components/event-time-summary";
import { OriginalEmailDialog } from "@/components/original-email-dialog";
import { NotificationEventActions } from "@/components/notification-event-actions";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { requireSessionUser } from "@/lib/session";
import { getEventTypeLabel } from "@/lib/event-types";

export default async function NotificationTimelinePage({ params }: { params: Promise<{ applicationId: string }> }) {
  const user = await requireSessionUser();
  const { applicationId } = await params;
  const [application, applicationOptions] = await Promise.all([
    prisma.application.findFirst({
      where: { id: applicationId, jobLead: { ownerId: user.id } },
      include: {
        jobLead: { select: { companyName: true, roleTitle: true } },
        events: { orderBy: [{ eventTime: "desc" }, { createdAt: "desc" }] }
      }
    }),
    prisma.application.findMany({
      where: { jobLead: { ownerId: user.id } },
      select: { id: true, jobLead: { select: { companyName: true, roleTitle: true } } },
      orderBy: { updatedAt: "desc" }
    })
  ]);

  if (!application) notFound();

  const events = application.events.sort((left, right) => notificationTimestamp(right) - notificationTimestamp(left));
  const eventGroups = [
    { status: "ACTIVE" as const, label: "待处理", events: events.filter((event) => event.status === "ACTIVE") },
    { status: "COMPLETED" as const, label: "已完成", events: events.filter((event) => event.status === "COMPLETED") },
    { status: "IGNORED" as const, label: "已忽略", events: events.filter((event) => event.status === "IGNORED") }
  ];
  const applications = applicationOptions.map((candidate) => ({
    id: candidate.id,
    label: `${candidate.jobLead.companyName} - ${candidate.jobLead.roleTitle}`
  }));

  return <PageShell title={`${application.jobLead.companyName} | ${application.jobLead.roleTitle}`} description={`通知时间线 · 共 ${events.length} 条`} action={<Link href="/notifications" className="inline-flex rounded-2xl border border-line px-4 py-3 text-sm font-medium text-ink">返回通知列表</Link>}>
    <div className="space-y-4">
      {eventGroups.map((group) => <details key={group.status} open={group.status === "ACTIVE"} className="rounded-3xl border border-line bg-white shadow-card">
        <summary className="cursor-pointer list-none px-4 py-3"><div className="flex items-center justify-between gap-3"><h2 className="font-semibold text-ink">{group.label}</h2><span className="rounded-full border border-line px-3 py-1 text-xs text-slate-500">{group.events.length} 条</span></div></summary>
        <div className="space-y-3 border-t border-line p-3">
          {group.events.length === 0 ? <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">暂无{group.label}通知。</p> : group.events.map((event) => {
            const details = readEventDetails(event.detailsJson);
            return <details key={event.id} open className={`group rounded-3xl border border-line bg-white shadow-card ${event.status === "COMPLETED" ? "opacity-70" : event.status === "IGNORED" ? "opacity-50" : ""}`}>
              <summary className="list-none cursor-pointer p-4"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500"><span>{getEventTypeLabel(event.eventType)}</span><span>记录于 {formatDate(event.createdAt)}</span></div><div className="mt-1"><EventTimeSummary {...event} /></div><h3 className="mt-1 truncate text-lg font-semibold text-ink">{event.title}</h3><p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{notificationSummary(event.title, details.content)}</p></div><div className="shrink-0"><NotificationEventActions status={event.status} applications={applications} event={{ id: event.id, applicationId: event.applicationId, eventType: event.eventType, status: event.status, title: event.title, eventTime: dateToIso(event.eventTime), windowStartAt: dateToIso(event.windowStartAt), deadlineAt: dateToIso(event.deadlineAt), receivedAt: dateToIso(event.receivedAt), relativeValidityMinutes: event.relativeValidityMinutes, content: details.content, requirements: details.requirements, artifactName: event.artifactName, artifactUrl: event.artifactUrl }} /></div></div></summary>
              <div className="border-t border-line px-4 pb-4 pt-4">
                <div className="flex items-center justify-between gap-3"><OriginalEmailDialog title={event.title} recordedAt={formatDate(event.receivedAt || event.createdAt)} content={details.content} /></div>
                <section className="mt-3 rounded-3xl border border-line bg-slate-50 p-4">
                  <h4 className="text-sm font-medium text-ink">通知摘要</h4>
                  <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">通知类型</dt><dd className="mt-1 text-ink">{getEventTypeLabel(event.eventType)}</dd></div><div><dt className="text-slate-500">状态</dt><dd className="mt-1 text-ink">{statusLabel(event.status)}</dd></div><div className="sm:col-span-2"><dt className="text-slate-500">时间安排</dt><dd className="mt-1"><EventTimeSummary {...event} /></dd></div><div className="sm:col-span-2"><dt className="text-slate-500">要求事项 / 后续动作</dt><dd className="mt-1 whitespace-pre-wrap text-ink">{details.requirements.length ? details.requirements.map((requirement) => `• ${requirement}`).join("\n") : "暂无"}</dd></div></dl>
                </section>
              </div>
            </details>;
          })}
        </div>
      </details>)}
    </div>
  </PageShell>;
}

function readEventDetails(detailsJson: string) {
  try {
    const parsed = JSON.parse(detailsJson) as { content?: unknown; requirements?: unknown };
    return {
      content: typeof parsed.content === "string" ? parsed.content : "",
      requirements: Array.isArray(parsed.requirements) ? parsed.requirements.filter((item): item is string => typeof item === "string") : [] as string[]
    };
  } catch {
    return { content: "", requirements: [] as string[] };
  }
}

function dateToIso(value: Date | null) {
  return value?.toISOString() ?? null;
}

function notificationSummary(title: string, content: string) {
  return title.trim() || content.replace(/\s+/g, " ").trim().slice(0, 160) || "通知详情待补充";
}

function notificationTimestamp(event: { eventTime: Date | null; createdAt: Date }) {
  return (event.eventTime || event.createdAt).getTime();
}

function statusLabel(status: "ACTIVE" | "COMPLETED" | "IGNORED") {
  return status === "ACTIVE" ? "待处理" : status === "COMPLETED" ? "已完成" : "已忽略";
}
