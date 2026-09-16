import Link from "next/link";
import { PageShell } from "@/components/app-shell";
import { DashboardActionItems } from "@/components/dashboard-action-items";
import { DashboardCalendar, type CalendarEvent } from "@/components/dashboard-calendar";
import { Panel } from "@/components/cards";
import { getDashboardData } from "@/lib/queries";

export default async function DashboardPage() {
  const { todayActionItems, calendarEvents, progress } =
    await getDashboardData();
  const calendarInitialDate = new Date().toISOString();
  const serializedCalendarEvents: CalendarEvent[] = calendarEvents.map((event) => ({
    id: event.id,
    applicationId: event.applicationId,
    eventType: event.eventType,
    status: event.status,
    title: event.title,
    eventTime: event.eventTime?.toISOString() ?? null,
    windowStartAt: event.windowStartAt?.toISOString() ?? null,
    deadlineAt: event.deadlineAt?.toISOString() ?? null,
    receivedAt: event.receivedAt?.toISOString() ?? null,
    relativeValidityMinutes: event.relativeValidityMinutes,
    companyName: event.application.jobLead.companyName
  }));

  return (
    <PageShell
      title="秋招工作流"
      description="聚焦今天要推进的事项、近期安排与整体求职进度。"
      action={<Link href="/notifications" className="inline-flex rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-white">导入或修正通知</Link>}
    >
      <DashboardActionItems initialItems={todayActionItems} />

      <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <Panel title="日历">
          <DashboardCalendar initialDate={calendarInitialDate} events={serializedCalendarEvents} />
        </Panel>

        <Panel title="求职进度">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <ProgressItem label="待投递" value={progress.readyToApply} />
            <ProgressItem label="已投递" value={progress.applied} />
            <ProgressItem label="测评" value={progress.assessment} />
            <ProgressItem label="面试" value={progress.interview} />
            <ProgressItem label="Offer" value={progress.offer} />
          </dl>
        </Panel>
      </div>
    </PageShell>
  );
}

function ProgressItem({ label, value }: { label: string; value: number }) {
  return <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2"><dt className="text-slate-500">{label}</dt><dd className="text-lg font-semibold tabular-nums text-ink">{value}</dd></div>;
}
