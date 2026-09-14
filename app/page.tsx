import Link from "next/link";
import { PageShell } from "@/components/app-shell";
import { Badge, Panel } from "@/components/cards";
import { getStageLabel } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { getDashboardData } from "@/lib/queries";
import { getRemainingDays } from "@/lib/workflow";

export default async function DashboardPage() {
  const { todayActionItems, upcomingDeadlineJobs, upcomingScheduleEvents, recentTimelineEvents } =
    await getDashboardData();

  return (
    <PageShell
      title="秋招工作流"
      description="只显示当前申请的下一步、临近关键事件和事件时间线。"
      action={<Link href="/notifications" className="inline-flex rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-white">导入或修正通知</Link>}
    >
      <Panel title="今天需要处理" subtitle="优先级固定：未投递的临近截止，其次临近笔试/面试，最后是人工填写的下一步。">
        <div className="space-y-3">
          {todayActionItems.length === 0 ? <EmptyState>今天暂无需要优先处理的事项。</EmptyState> : todayActionItems.map((item) => (
            <Link key={item.id} href={item.href} className="flex items-start justify-between gap-4 rounded-2xl border border-line p-4 transition hover:border-accent">
              <div className="min-w-0">
                <div className="truncate font-medium text-ink">{item.companyName} | {item.roleTitle}</div>
                <div className="mt-1 text-sm text-slate-600">{item.reason}</div>
                <div className="mt-1 text-xs text-slate-400">{item.timeLabel}：{formatDate(item.timeAt)}</div>
              </div>
              <Badge>{getStageLabel(item.stage)}</Badge>
            </Link>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="即将截止" subtitle="未来 5 天内的截止时间；同一岗位只保留最早的一项。">
          <div className="space-y-3">
            {upcomingDeadlineJobs.length === 0 ? <EmptyState>未来 5 天内暂无即将截止的岗位。</EmptyState> : upcomingDeadlineJobs.map((job) => (
              <Link key={job.id} href={`/jobs/${job.id}`} className="flex items-start justify-between gap-4 rounded-2xl border border-line p-4 transition hover:border-accent">
                <div className="min-w-0">
                  <div className="truncate font-medium text-ink">{job.companyName} | {job.roleTitle}</div>
                  <div className="mt-1 text-sm text-slate-500">截止日期：{formatDate(job.deadlineAt)}</div>
                </div>
                <Badge>剩余 {getRemainingDays(job.deadlineAt, new Date())} 天</Badge>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel title="即将到来的笔试/面试" subtitle="未来 5 天内的安排；同一申请、类型和时间只显示一次。">
          <div className="space-y-3">
            {upcomingScheduleEvents.length === 0 ? <EmptyState>未来 5 天内暂无笔试或面试安排。</EmptyState> : upcomingScheduleEvents.map((event) => (
              <Link key={event.id} href={`/jobs/${event.application.jobLead.id}`} className="flex items-start justify-between gap-4 rounded-2xl border border-line p-4 transition hover:border-accent">
                <div className="min-w-0">
                  <div className="truncate font-medium text-ink">{event.application.jobLead.companyName} | {event.application.jobLead.roleTitle}</div>
                  <div className="mt-1 text-sm text-slate-500">{event.eventType === "INTERVIEW" ? "面试" : "笔试"}：{formatDate(event.eventTime)}</div>
                </div>
                <Badge>{getStageLabel(event.application.currentStage)}</Badge>
              </Link>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="最近事件" subtitle="通知导入和人工修正都保留为 Event 时间线来源；重复关键事件只显示一次。">
        <div className="space-y-3">
          {recentTimelineEvents.length === 0 ? <EmptyState>还没有事件记录。可以从通知管理导入或人工补充。</EmptyState> : recentTimelineEvents.map((event) => (
            <Link key={event.id} href={`/jobs/${event.application.jobLead.id}`} className="block rounded-2xl border border-line p-4 transition hover:border-accent">
              <div className="text-sm font-medium text-ink">{event.application.jobLead.companyName} | {event.application.jobLead.roleTitle}</div>
              <div className="mt-1 text-sm text-slate-600">{event.title}</div>
              <div className="mt-2 text-xs text-slate-400">{formatDate(event.eventTime || event.createdAt)}</div>
            </Link>
          ))}
        </div>
      </Panel>
    </PageShell>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl bg-panel p-4 text-sm text-slate-500">{children}</div>;
}
