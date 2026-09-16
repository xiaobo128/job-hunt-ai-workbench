import Link from "next/link";
import { PageShell } from "@/components/app-shell";
import { AddNotificationDialog } from "@/components/add-notification-dialog";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { requireSessionUser } from "@/lib/session";

const eventTypeLabels: Record<string, string> = { NOTE: "备注", ASSESSMENT: "测评", INTERVIEW: "面试", OFFER: "录用", REJECTION: "拒绝", DEADLINE: "截止时间" };

export default async function NotificationsPage() {
  const user = await requireSessionUser();
  const [applications, applicationOptions] = await Promise.all([
    prisma.application.findMany({
      where: {
        currentStage: { not: "CLOSED" },
        jobLead: { ownerId: user.id, status: { not: "CLOSED" } },
        events: { some: {} }
      },
      include: { jobLead: { select: { companyName: true, roleTitle: true } }, events: { orderBy: [{ eventTime: "desc" }, { createdAt: "desc" }] } }
    }),
    prisma.application.findMany({
      where: { currentStage: { not: "CLOSED" }, jobLead: { ownerId: user.id, status: { not: "CLOSED" } } },
      include: { jobLead: { select: { companyName: true, roleTitle: true } } }, orderBy: { updatedAt: "desc" }
    })
  ]);
  const groups = applications
    .map((application) => ({ ...application, events: application.events.sort((left, right) => notificationTimestamp(right) - notificationTimestamp(left)) }))
    .map((application) => ({ ...application, latestEvent: application.events[0] }))
    .filter((application): application is typeof application & { latestEvent: (typeof application.events)[number] } => Boolean(application.latestEvent))
    .sort((left, right) => notificationTimestamp(right.latestEvent) - notificationTimestamp(left.latestEvent));

  return <PageShell title="通知管理" description="按申请机会查看通知；选择某个机会可查看完整历史时间线。" action={<AddNotificationDialog applications={applicationOptions.map((application) => ({ id: application.id, label: `${application.jobLead.companyName} | ${application.jobLead.roleTitle}` }))} />}>
    <div className="space-y-3">
      {groups.length === 0 ? <div className="rounded-3xl border border-line bg-white p-6 text-sm text-slate-500 shadow-card">还没有通知记录。可以用右上角按钮先导入第一条。</div> : groups.map((application) => <Link key={application.id} href={`/notifications/${application.id}`} className={`block rounded-3xl border border-line bg-white p-4 shadow-card transition hover:border-slate-300 hover:shadow-md ${application.latestEvent.status === "COMPLETED" ? "opacity-70" : application.latestEvent.status === "IGNORED" ? "opacity-50" : ""}`}>
        <div className="flex items-start justify-between gap-4"><div className="min-w-0"><h2 className="truncate text-lg font-semibold text-ink">{application.jobLead.companyName} | {application.jobLead.roleTitle}</h2><div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500"><span>{application.events.length} 条通知</span><span>{eventTypeLabels[application.latestEvent.eventType] ?? application.latestEvent.eventType}</span><span>{formatDate(application.latestEvent.eventTime || application.latestEvent.createdAt)}</span></div><p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{notificationSummary(application.latestEvent.title, application.latestEvent.detailsJson)}</p></div><span className="shrink-0 rounded-full border border-line px-3 py-1 text-xs text-slate-500">{eventStatusLabel(application.latestEvent.status)} · 查看时间线</span></div>
      </Link>)}
    </div>
  </PageShell>;
}

function notificationTimestamp(event: { eventTime: Date | null; createdAt: Date }) { return (event.eventTime || event.createdAt).getTime(); }
function notificationSummary(title: string, detailsJson: string) {
  if (title.trim()) return title.trim();
  try { const parsed = JSON.parse(detailsJson) as { content?: unknown }; return typeof parsed.content === "string" ? parsed.content.replace(/\s+/g, " ").trim().slice(0, 160) || "通知详情待补充" : "通知详情待补充"; } catch { return "通知详情待补充"; }
}
function eventStatusLabel(status: string) { return status === "COMPLETED" ? "✓ 已完成" : status === "IGNORED" ? "已忽略" : "待处理"; }
