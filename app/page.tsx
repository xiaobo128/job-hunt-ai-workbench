import Link from "next/link";
import { PageShell } from "@/components/app-shell";
import { Panel, StatCard, Badge } from "@/components/cards";
import { getDashboardData } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { getStageLabel } from "@/lib/constants";

export default async function DashboardPage() {
  const {
    jobsCount,
    resumesCount,
    applicationsCount,
    recentJobs,
    recentEvents,
    needsReviewJobs,
    fallbackItems,
    upcomingDeadlineJobs,
    todayActionItems
  } = await getDashboardData();

  return (
    <PageShell
      title="总览"
      description="把岗位导入、岗位核对、简历微调、申请推进和通知沉淀串成一条完整的求职工作流。"
      action={
        <Link href="/jobs" className="inline-flex rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-white">
          进入岗位工作台
        </Link>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="岗位线索" value={String(jobsCount)} hint="统一导入的岗位与线索" />
        <StatCard label="在推进申请" value={String(applicationsCount)} hint="每条申请都绑定推进情况与备注" />
        <StatCard label="原始简历" value={String(resumesCount)} hint="简历仓库统一管理基础版本" />
        <StatCard label="最近事件" value={String(recentEvents.length)} hint="通知解析和手动补录都会沉淀在这里" />
      </div>

      <Panel title="今天需要处理" subtitle="根据现有岗位、申请和通知记录整理的优先行动。">
        <div className="space-y-3">
          {todayActionItems.length === 0 ? (
            <div className="rounded-2xl bg-panel p-4 text-sm text-slate-500">今天暂无需要优先处理的事项。</div>
          ) : (
            todayActionItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="flex items-start justify-between gap-4 rounded-2xl border border-line p-4 transition hover:border-accent"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-ink">
                    {item.companyName} | {item.roleTitle}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">{item.reason}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {item.timeLabel}：{formatDate(item.timeAt)}
                  </div>
                </div>
                <Badge>待查看</Badge>
              </Link>
            ))
          )}
        </div>
      </Panel>

      <Panel title="即将截止" subtitle="未来 5 天内需要关注的岗位截止时间。">
        <div className="space-y-3">
          {upcomingDeadlineJobs.length === 0 ? (
            <div className="rounded-2xl bg-panel p-4 text-sm text-slate-500">未来 5 天内暂无即将截止的岗位。</div>
          ) : (
            upcomingDeadlineJobs.map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="flex items-start justify-between gap-4 rounded-2xl border border-line p-4 transition hover:border-accent"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-ink">
                    {job.companyName} | {job.roleTitle}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">截止日期：{formatDate(job.deadlineAt)}</div>
                </div>
                <Badge>剩余 {getRemainingDays(job.deadlineAt)} 天</Badge>
              </Link>
            ))
          )}
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="待确认岗位" subtitle="新导入的岗位建议先核对一次，再进入正式推进。">
          <div className="space-y-3">
            {needsReviewJobs.length === 0 ? (
              <div className="rounded-2xl bg-panel p-4 text-sm text-slate-500">当前没有待确认岗位。</div>
            ) : (
              needsReviewJobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}?review=1`}
                  className="flex items-start justify-between rounded-2xl border border-line p-4 transition hover:border-accent"
                >
                  <div>
                    <div className="font-medium text-ink">
                      {job.companyName} | {job.roleTitle}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">{job.parseNote || "建议先核对系统解析结果。"}</div>
                  </div>
                  <Badge>待确认</Badge>
                </Link>
              ))
            )}
          </div>
        </Panel>

        <Panel title="建议复核的 AI 结果" subtitle="这些结果依然可用，但建议你再快速确认一下关键字段。">
          <div className="space-y-3">
            {fallbackItems.length === 0 ? (
              <div className="rounded-2xl bg-panel p-4 text-sm text-slate-500">最近没有需要人工复核的 AI 结果。</div>
            ) : (
              fallbackItems.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="flex items-start justify-between rounded-2xl border border-line p-4 transition hover:border-accent"
                >
                  <div>
                    <div className="font-medium text-ink">
                      {job.companyName} | {job.roleTitle}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">{job.parseNote || "这条结果建议你人工快速核对一下。"}</div>
                  </div>
                  <Badge>建议复核</Badge>
                </Link>
              ))
            )}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="最近岗位" subtitle="从这里可以直接回到岗位工作台里的具体岗位。">
          <div className="space-y-3">
            {recentJobs.map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="flex items-start justify-between rounded-2xl border border-line p-4 transition hover:border-accent"
              >
                <div>
                  <div className="font-medium text-ink">
                    {job.companyName} | {job.roleTitle}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    {job.city || "地点待确认"} | {job.sourceName || "主动导入"}
                  </div>
                </div>
                <Badge>{getStageLabel(job.status)}</Badge>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel title="最近事件" subtitle="面试、笔试和备注都会沉淀到事件流里。">
          <div className="space-y-3">
            {recentEvents.map((event) => (
              <div key={event.id} className="rounded-2xl border border-line p-4">
                <div className="text-sm font-medium text-ink">
                  {event.application.jobLead.companyName} | {event.application.jobLead.roleTitle}
                </div>
                <div className="mt-1 text-sm text-slate-600">{event.title}</div>
                <div className="mt-2 text-xs text-slate-400">{formatDate(event.eventTime || event.createdAt)}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </PageShell>
  );
}

function getRemainingDays(deadlineAt: Date) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.ceil((deadlineAt.getTime() - Date.now()) / millisecondsPerDay));
}
