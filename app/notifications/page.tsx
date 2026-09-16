import { PageShell } from "@/components/app-shell";
import { AddNotificationDialog } from "@/components/add-notification-dialog";
import { NotificationOpportunityList } from "@/components/notification-opportunity-list";
import { prisma } from "@/lib/db";
import { getStageDisplayLabel } from "@/lib/constants";
import { requireSessionUser } from "@/lib/session";

export default async function NotificationsPage() {
  const user = await requireSessionUser();
  const [applications, applicationOptions] = await Promise.all([
    prisma.application.findMany({
      where: {
        currentStage: { not: "CLOSED" },
        jobLead: { ownerId: user.id, status: { not: "CLOSED" } },
        events: { some: {} }
      },
      include: {
        jobLead: { select: { companyName: true, roleTitle: true } },
        _count: { select: { events: true } }
      }
    }),
    prisma.application.findMany({
      where: { currentStage: { not: "CLOSED" }, jobLead: { ownerId: user.id, status: { not: "CLOSED" } } },
      include: { jobLead: { select: { companyName: true, roleTitle: true } } },
      orderBy: { updatedAt: "desc" }
    })
  ]);
  const opportunities = applications
    .sort(compareApplicationOrder)
    .map((application) => ({
      id: application.id,
      companyName: application.jobLead.companyName,
      roleTitle: application.jobLead.roleTitle,
      stageLabel: getStageDisplayLabel(application.currentStage),
      notificationCount: application._count.events
    }));

  return <PageShell title="通知管理" description="按求职机会查看通知历史，并可拖动调整机会优先级。" action={<AddNotificationDialog applications={applicationOptions.map((application) => ({ id: application.id, label: `${application.jobLead.companyName} | ${application.jobLead.roleTitle}` }))} />}>
    {opportunities.length === 0 ? <div className="rounded-3xl border border-line bg-white p-6 text-sm text-slate-500 shadow-card">还没有通知记录。可以用右上角按钮先导入第一条。</div> : <NotificationOpportunityList initialOpportunities={opportunities} />}
  </PageShell>;
}

function compareApplicationOrder(left: { displayOrder: number | null; createdAt: Date; id: string }, right: { displayOrder: number | null; createdAt: Date; id: string }) {
  if (left.displayOrder !== null && right.displayOrder !== null) return left.displayOrder - right.displayOrder || left.id.localeCompare(right.id);
  if (left.displayOrder !== null) return -1;
  if (right.displayOrder !== null) return 1;
  return left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id);
}
