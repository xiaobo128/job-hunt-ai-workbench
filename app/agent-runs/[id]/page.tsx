import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/app-shell";
import { Panel } from "@/components/cards";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { requireSessionUser } from "@/lib/session";

export default async function AgentRunDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string; jobId?: string }>;
}) {
  const user = await requireSessionUser();
  const { id } = await params;
  const { back, jobId } = await searchParams;

  const run = await prisma.agentRun.findFirst({
    where: {
      id,
      userId: user.id
    },
    include: {
      jobLead: {
        select: {
          id: true,
          companyName: true,
          roleTitle: true
        }
      },
      resume: {
        select: {
          id: true,
          title: true
        }
      },
      resumeVariant: {
        select: {
          id: true,
          title: true
        }
      },
      event: {
        select: {
          id: true,
          title: true,
          eventType: true
        }
      }
    }
  });

  if (!run) {
    notFound();
  }

  const backHref = buildBackHref({ back, jobId, linkedJobId: run.jobLead?.id || null });

  return (
    <PageShell
      title={`自动化运行详情 | ${run.kind}`}
      description="这里可以查看这次自动化运行的输入、输出、时间戳以及关联记录。"
      action={
        <Link href={backHref} className="inline-flex rounded-2xl border border-line px-4 py-3 text-sm">
          返回
        </Link>
      }
    >
      <div className="space-y-4">
        <Panel title="运行概览" subtitle="这里展示这次自动化执行的核心元信息。">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Info label="类型">{run.kind}</Info>
            <Info label="来源">{run.source}</Info>
            <Info label="状态">{run.status}</Info>
            <Info label="创建时间">{formatDate(run.createdAt)}</Info>
            <Info label="更新时间">{formatDate(run.updatedAt)}</Info>
            <Info label="运行 ID">{run.id}</Info>
          </div>
          {run.errorMessage ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {run.errorMessage}
            </div>
          ) : null}
        </Panel>

        <Panel title="关联记录" subtitle="这些链接会显示这次运行在工作台内关联到了哪些对象。">
          <div className="grid gap-4 md:grid-cols-2">
            <Info label="岗位">
              {run.jobLead ? (
                <Link href={`/jobs/${run.jobLead.id}`} className="text-accent underline-offset-4 hover:underline">
                  {run.jobLead.companyName} | {run.jobLead.roleTitle}
                </Link>
              ) : (
                "未关联"
              )}
            </Info>
            <Info label="基础简历">
              {run.resume ? (
                <Link href="/resumes" className="text-accent underline-offset-4 hover:underline">
                  {run.resume.title}
                </Link>
              ) : (
                "未关联"
              )}
            </Info>
            <Info label="简历版本">
              {run.resumeVariant ? (
                <Link href="/resumes" className="text-accent underline-offset-4 hover:underline">
                  {run.resumeVariant.title}
                </Link>
              ) : (
                "未关联"
              )}
            </Info>
            <Info label="事件">{run.event ? `${run.event.eventType} | ${run.event.title}` : "未关联"}</Info>
          </div>
        </Panel>

        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="输入载荷" subtitle="这里保留这次运行开始时捕获的原始 payload。">
            <JsonBlock value={run.inputJson} emptyLabel="这次运行没有保存输入 payload。" />
          </Panel>

          <Panel title="输出载荷" subtitle="这里保留这次运行结束时捕获的原始 payload。">
            <JsonBlock value={run.outputJson} emptyLabel="这次运行没有保存输出 payload。" />
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-panel p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-2 break-words text-sm text-ink">{children}</div>
    </div>
  );
}

function JsonBlock({ value, emptyLabel }: { value: string | null; emptyLabel: string }) {
  if (!value) {
    return <div className="rounded-2xl bg-panel px-4 py-3 text-sm text-slate-500">{emptyLabel}</div>;
  }

  return (
    <pre className="overflow-x-auto whitespace-pre-wrap rounded-2xl bg-panel p-4 text-xs leading-6 text-slate-700">
      {formatJsonString(value)}
    </pre>
  );
}

function formatJsonString(value: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function buildBackHref({
  back,
  jobId,
  linkedJobId
}: {
  back?: string;
  jobId?: string;
  linkedJobId: string | null;
}) {
  if (back === "job" && (jobId || linkedJobId)) {
    return `/jobs/${jobId || linkedJobId}`;
  }

  return "/account";
}
