import { notFound } from "next/navigation";
import { PageShell } from "@/components/app-shell";
import { NotificationReviewForm } from "@/components/notification-review-form";
import { prisma } from "@/lib/db";
import { requireSessionUser } from "@/lib/session";

export default async function NotificationReviewPage({ params }: { params: Promise<{ applicationId: string; eventId: string }> }) {
  const user = await requireSessionUser();
  const { applicationId, eventId } = await params;
  const [event, applications] = await Promise.all([
    prisma.event.findFirst({
      where: { id: eventId, applicationId, application: { jobLead: { ownerId: user.id } } },
      include: { application: { select: { jobLead: { select: { companyName: true, roleTitle: true } } } } }
    }),
    prisma.application.findMany({
      where: { jobLead: { ownerId: user.id } },
      select: { id: true, jobLead: { select: { companyName: true, roleTitle: true } } },
      orderBy: { updatedAt: "desc" }
    })
  ]);

  if (!event) notFound();

  return <PageShell title="确认通知信息" description="系统已识别以下信息，请核对后保存。">
    <NotificationReviewForm
      event={{
        id: event.id, applicationId: event.applicationId, eventType: event.eventType, status: event.status, title: event.title,
        eventTime: event.eventTime?.toISOString() ?? null, windowStartAt: event.windowStartAt?.toISOString() ?? null,
        deadlineAt: event.deadlineAt?.toISOString() ?? null, receivedAt: event.receivedAt?.toISOString() ?? null,
        relativeValidityMinutes: event.relativeValidityMinutes, detailsJson: event.detailsJson
      }}
      applications={applications.map((application) => ({ id: application.id, label: `${application.jobLead.companyName} | ${application.jobLead.roleTitle}` }))}
    />
  </PageShell>;
}
