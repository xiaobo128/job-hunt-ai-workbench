import Link from "next/link";
import { PageShell } from "@/components/app-shell";
import { Panel } from "@/components/cards";
import { prisma } from "@/lib/db";
import { getRuntimeConfig } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { requireSessionUser } from "@/lib/session";
import { RuntimeItem } from "../_components/account-sections";

export default async function AccountStatusPage() {
  const user = await requireSessionUser();
  const runtime = getRuntimeConfig();
  const recentAgentRuns = await prisma.agentRun.findMany({
    where: { userId: user.id },
    include: {
      jobLead: { select: { companyName: true, roleTitle: true } },
      resume: { select: { title: true } },
      event: { select: { title: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 8
  });
  const hasUserAiKey = Boolean(user.aiApiKey);
  const productionBlockers = [
    !runtime.deployment.usesHttpsAppUrl ? "APP_URL 还没有切到 HTTPS 的正式域名。" : null,
    runtime.database.provider !== "postgresql" ? "数据库当前还不是 PostgreSQL。" : null,
    runtime.storage.provider === "local" ? "文件存储仍然在使用本地开发模式。" : null,
    runtime.storage.provider === "vercel-blob" && !runtime.storage.isProductionReady
      ? "Vercel Blob Token 还没有配置完整。"
      : null
  ].filter(Boolean) as string[];

  return (
    <PageShell
      title="服务状态"
      description="查看部署可用性和最近自动化运行情况，判断当前环境是否适合稳定使用。"
      action={
        <Link href="/account" className="inline-flex rounded-2xl border border-line px-4 py-3 text-sm">
          返回设置首页
        </Link>
      }
    >
      <Panel title="部署状态" subtitle="这些检查项可以帮助你判断离正式上线还差什么。">
        <div className="space-y-3">
          <RuntimeItem label="应用地址" value={runtime.appUrl || "未配置"} ready={runtime.deployment.usesHttpsAppUrl} />
          <RuntimeItem label="数据库" value={runtime.database.provider} ready={runtime.database.isProductionReady} />
          <RuntimeItem label="文件存储" value={runtime.storage.provider} ready={runtime.storage.isProductionReady} />
          <RuntimeItem
            label="AI 配置"
            value={hasUserAiKey ? "已配置用户级密钥" : "使用环境变量或降级模式"}
            ready={hasUserAiKey || runtime.ai.hasOpenAi}
          />
        </div>
        <div className="mt-4 rounded-2xl bg-panel p-4">
          <div className="text-sm font-medium text-ink">
            {runtime.deployment.readyForProduction ? "当前环境已经比较接近可正式上线状态。" : "当前环境还有几项生产基础配置需要补齐。"}
          </div>
          <div className="mt-2 text-sm text-slate-600">
            {productionBlockers.length === 0 ? "核心部署条件已经基本具备。" : "建议先处理下面这些阻塞项，再对外公开发布。"}
          </div>
          {productionBlockers.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {productionBlockers.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </Panel>

      <Panel title="最近 Agent 运行记录" subtitle="入站 API 写回和出站 webhook 触发，都会记录在这里，方便你检查自动化是否按预期运行。">
        {recentAgentRuns.length === 0 ? (
          <div className="rounded-2xl bg-panel px-4 py-3 text-sm text-slate-500">还没有任何 Agent 运行记录。</div>
        ) : (
          <div className="space-y-3">
            {recentAgentRuns.map((run) => (
              <div key={run.id} className="rounded-2xl border border-line p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-sm font-medium text-ink">
                      {run.kind} | {run.source} | {run.status}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {run.jobLead
                        ? `${run.jobLead.companyName} | ${run.jobLead.roleTitle}`
                        : run.resume
                          ? `简历：${run.resume.title}`
                          : run.event
                            ? `事件：${run.event.title}`
                            : "没有关联对象"}
                    </div>
                    {run.errorMessage ? <div className="mt-1 text-sm text-rose-600">{run.errorMessage}</div> : null}
                    <div className="mt-2">
                      <Link href={`/agent-runs/${run.id}?back=account`} className="text-sm text-accent underline-offset-4 hover:underline">
                        查看运行详情
                      </Link>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">{formatDate(run.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </PageShell>
  );
}
