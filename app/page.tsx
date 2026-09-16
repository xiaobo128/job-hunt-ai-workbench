import Link from "next/link";
import { PageShell } from "@/components/app-shell";
import { Panel } from "@/components/cards";
import { getDashboardData } from "@/lib/queries";

export default async function DashboardPage() {
  const { todayActionItems, calendarEvents, progress } =
    await getDashboardData();
  const monthLabel = new Intl.DateTimeFormat("zh-CN", { month: "long" }).format(new Date());

  return (
    <PageShell
      title="秋招工作流"
      description="聚焦今天要推进的事项、近期安排与整体求职进度。"
      action={<Link href="/notifications" className="inline-flex rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-white">导入或修正通知</Link>}
    >
      <Panel title={`今天有 ${todayActionItems.length} 件事需要处理`} subtitle="今日 / 即将到期">
        <div className="divide-y divide-line">
          {todayActionItems.length === 0 ? <EmptyState>目前没有临近的待办或安排。</EmptyState> : todayActionItems.map((item) => (
            <Link key={item.id} href={item.href} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0 transition hover:text-accent">
              <p className="min-w-0 truncate text-sm text-ink"><span className="font-medium">{item.companyName}</span>：{item.reason}</p>
              <span className="shrink-0 text-xs text-slate-400">{formatRelativeTime(item.timeAt)}</span>
            </Link>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <Panel title="日历" subtitle={monthLabel}>
          <div className="space-y-1">
            {calendarEvents.length === 0 ? <EmptyState>本月暂无测评或面试安排。</EmptyState> : calendarEvents.map((event) => (
              <Link key={event.id} href={`/jobs/${event.application.jobLead.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-panel">
                <span className="w-8 text-sm font-semibold tabular-nums text-accent">{event.eventTime?.getDate()}</span>
                <span className="min-w-0 truncate text-sm text-slate-700">{event.application.jobLead.companyName} · {event.title || (event.eventType === "INTERVIEW" ? "面试" : "测评")}</span>
              </Link>
            ))}
          </div>
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

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl bg-panel p-4 text-sm text-slate-500">{children}</div>;
}

function ProgressItem({ label, value }: { label: string; value: number }) {
  return <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2"><dt className="text-slate-500">{label}</dt><dd className="text-lg font-semibold tabular-nums text-ink">{value}</dd></div>;
}

function formatRelativeTime(value: Date) {
  const now = new Date();
  const milliseconds = value.getTime() - now.getTime();
  const hours = Math.ceil(milliseconds / (60 * 60 * 1000));
  if (hours > 0 && hours < 24) return `${hours} 小时后`;
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (value >= tomorrow && value < new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate() + 1)) return `明天 ${formatTime(value)}`;
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(value);
}

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(value);
}
