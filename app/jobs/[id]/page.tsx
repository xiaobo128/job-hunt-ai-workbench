import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { triggerStatusSync, updateApplicationStage, updateJobLead } from "@/app/actions";
import { PageShell } from "@/components/app-shell";
import { Panel } from "@/components/cards";
import { JobDetailReturnButton } from "@/components/job-detail-return-button";
import { JobDetailSubmitButton } from "@/components/job-detail-submit-button";
import { JobStageProgress } from "@/components/job-stage-progress";
import { AgentHandoffPanel } from "@/components/agent-handoff-panel";
import { ApplicationStageBadge } from "@/components/application-stage-badge";
import { EventTimeSummary } from "@/components/event-time-summary";
import { DeleteJobForm } from "@/components/delete-job-form";
import { createAgentHandoffInput } from "@/lib/agent-handoff";
import { normalizeApplicationStage, stageOptions } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatDate, listToMultiline } from "@/lib/format";
import { getJobById } from "@/lib/queries";

export default async function JobDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    review?: string;
    workspaceView?: string;
    q?: string;
    status?: string;
    city?: string;
    source?: string;
  }>;
}) {
  const { id } = await params;
  const { review, workspaceView, q, status, city, source } = await searchParams;
  const job = await getJobById(id);

  if (!job || !job.application) {
    notFound();
  }

  const workspaceHref = buildWorkspaceHref({
    workspaceView: workspaceView === "board" ? "board" : "table",
    query: q || "",
    status: status || "",
    city: city || "",
    source: source || ""
  });

  const detailFormId = `job-detail-form-${job.id}`;
  const initialSnapshot = JSON.stringify({
    parseNote: job.parseNote || "",
    companyName: job.companyName || "",
    roleTitle: job.roleTitle || "",
    sourceName: job.sourceName || "",
    sourceUrl: job.sourceUrl || "",
    city: job.city || "",
    seniority: job.seniority || "",
    salaryRange: job.salaryRange || "",
    responsibilitiesText: listToMultiline(job.responsibilities),
    requirementsText: listToMultiline(job.requirements)
  });

  const primaryResume = job.application.usedResume
    ? null
    : await prisma.resume.findFirst({
        where: { ownerId: job.ownerId, isPrimary: true },
        select: {
          id: true,
          title: true,
          parseAttempts: {
            where: { status: "CONFIRMED" },
            orderBy: [{ confirmedAt: "desc" }, { id: "asc" }],
            take: 1,
            select: { id: true, documentJson: true }
          }
        }
      });
  const selectedResume = job.application.usedResume ?? primaryResume;
  const selectedParse = selectedResume?.parseAttempts[0] ?? null;
  const handoffInput = createAgentHandoffInput({
    job,
    application: job.application,
    events: job.application.events,
    candidateSource: selectedResume && selectedParse
      ? {
          resumeId: selectedResume.id,
          resumeTitle: selectedResume.title,
          confirmedParseId: selectedParse.id,
          documentJson: selectedParse.documentJson
        }
      : null
  });

  return (
    <PageShell
      title={buildJobTitle(job.companyName, job.roleTitle)}
      description={
        review
          ? "系统已先解析岗位字段。核对并保存后，就可以回到工作台继续推进。"
          : "这里集中维护岗位信息、推进状态、通知记录和关联简历。"
      }
    >
      <div className="space-y-3">
        <div className="flex justify-end">
          <JobDetailReturnButton href={workspaceHref} formId={detailFormId} initialSnapshot={initialSnapshot} />
        </div>
        <Panel
          title="岗位信息"
          subtitle={
            job.needsReview
              ? [
                  "这条岗位还处于待确认状态。请先核对解析结果，确认后再保存。",
                  job.parseNote?.trim() ? `解析说明：${job.parseNote.trim()}` : ""
                ]
                  .filter(Boolean)
                  .join(" ")
              : [
                  "这里保留岗位的结构化信息和来源信息。",
                  job.parseNote?.trim() ? `解析说明：${job.parseNote.trim()}` : ""
                ]
                  .filter(Boolean)
                  .join(" ")
          }
        >
          <form id={detailFormId} action={updateJobLead} className="space-y-3">
            <input type="hidden" name="jobLeadId" value={job.id} />
            <input type="hidden" name="redirectTo" value={workspaceHref} />
            <input type="hidden" name="parseNote" value={job.parseNote || ""} />

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Info label="解析来源">
                <ProviderBadge provider={job.parseProvider} />
              </Info>
              <Info label="原始内容">
                <Link href={`/jobs/${job.id}/source`} className="text-accent underline-offset-4 hover:underline">
                  查看导入原文
                </Link>
              </Info>
              <Info label="当前推进情况">
                <ApplicationStageBadge stage={job.application.currentStage} customLabel={job.application.nextAction} />
              </Info>
              <Info label="最近更新">{formatDate(job.updatedAt)}</Info>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Field label="公司名称" name="companyName" defaultValue={job.companyName} />
              <Field label="岗位" name="roleTitle" defaultValue={job.roleTitle} />
              <Field label="来源备注" name="sourceName" defaultValue={job.sourceName || ""} />
              <Field label="来源链接" name="sourceUrl" defaultValue={job.sourceUrl || ""} />
              <Field label="城市 / Base" name="city" defaultValue={job.city || ""} />
              <Field label="工作年限" name="seniority" defaultValue={job.seniority || ""} />
              <Field label="薪资范围" name="salaryRange" defaultValue={job.salaryRange || ""} />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <TextAreaField
                label="岗位职责"
                name="responsibilitiesText"
                defaultValue={listToMultiline(job.responsibilities)}
                rows={8}
              />
              <TextAreaField
                label="岗位要求"
                name="requirementsText"
                defaultValue={listToMultiline(job.requirements)}
                rows={8}
              />
            </div>

            <JobDetailSubmitButton
              idleLabel="保存岗位信息"
              pendingLabel="保存中..."
              className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-ink px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
            />
          </form>
        </Panel>

        <Panel title="求职进度" subtitle="点击节点更新当前主流程阶段；详细推进信息仍在下方的推进备注中维护。">
          <JobStageProgress
            applicationId={job.application.id}
            currentStage={job.application.currentStage}
            hasRejectionEvent={job.application.events.some((event) => event.eventType === "REJECTION")}
          />
        </Panel>

        <AgentHandoffPanel input={handoffInput} />

        <Panel title="推进备注" subtitle="推进情况、投递渠道、面试安排、联系人和个人判断都会同步到岗位工作台。">
          <form action={updateApplicationStage} className="space-y-3">
            <input type="hidden" name="applicationId" value={job.application.id} />
            <input type="hidden" name="jobLeadId" value={job.id} />

            <label className="block text-sm text-slate-600">
              推进情况
              <select
                name="stage"
                defaultValue={normalizeApplicationStage(job.application.currentStage)}
                className="mt-2 h-10 w-full rounded-xl border border-line bg-panel px-3.5 text-sm outline-none"
              >
                {stageOptions.map((stage) => (
                  <option key={stage.value} value={stage.value}>
                    {stage.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm text-slate-600">
              其他推进状态（可选）
              <input
                name="nextAction"
                defaultValue={job.application.nextAction || ""}
                className="mt-2 h-10 w-full rounded-xl border border-line bg-panel px-3.5 text-sm outline-none"
                placeholder="例如：等待 HR 回电 / 约面中 / 补材料"
              />
            </label>

            <label className="block text-sm text-slate-600">
              投递渠道
              <input
                name="submissionChannel"
                defaultValue={job.application.submissionChannel || ""}
                className="mt-2 h-10 w-full rounded-xl border border-line bg-panel px-3.5 text-sm outline-none"
                placeholder="例如：官网 / Boss / 内推 / 邮件"
              />
            </label>

            <label className="block text-sm text-slate-600">
              备注
              <textarea
                name="note"
                defaultValue={job.application.note || ""}
                rows={8}
                className="mt-2 w-full rounded-2xl border border-line bg-panel px-3.5 py-3 text-sm leading-6 outline-none"
                placeholder="把面试安排、联系人、风险点和个人判断都记在这里。"
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <button className="inline-flex h-10 items-center justify-center rounded-xl bg-accent px-4 text-sm font-medium text-white">
                保存推进信息
              </button>
              <button
                formAction={triggerStatusSync}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-line px-4 text-sm font-medium text-ink"
              >
                同步到自动化
              </button>
            </div>
          </form>

          <div className="mt-4 space-y-3 border-t border-line pt-4">
            <div className="text-sm font-medium text-ink">已有记录</div>
            {job.application.events.length === 0 ? (
              <div className="rounded-2xl bg-panel px-4 py-3 text-sm text-slate-500">暂无历史记录。</div>
            ) : (
              job.application.events.map((event) => (
                <div key={event.id} className="rounded-2xl border border-line p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-medium text-ink">{event.title}</div>
                    <ProviderBadge provider={event.aiProvider} />
                  </div>
                  {event.aiNote ? <p className="mt-2 text-xs leading-5 text-slate-500">{event.aiNote}</p> : null}
                  {event.artifactUrl ? (
                    <a
                      href={event.artifactUrl}
                      target="_blank"
                      className="mt-2 block text-sm text-accent underline-offset-4 hover:underline"
                    >
                      {event.artifactName || "查看附件"}
                    </a>
                  ) : null}
                  <div className="mt-2"><EventTimeSummary {...event} /></div>
                  <div className="mt-1 text-xs text-slate-400">记录于 {formatDate(event.createdAt)}</div>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel title="最近 Agent 运行记录" subtitle="这里会显示与这个岗位相关的接口写回和 webhook 触发结果。">
          {job.agentRuns.length === 0 ? (
            <div className="rounded-2xl bg-panel px-4 py-3 text-sm text-slate-500">
              这个岗位暂无 Agent 运行记录。
            </div>
          ) : (
            <div className="space-y-3">
              {job.agentRuns.map((run) => (
                <div key={run.id} className="rounded-2xl border border-line p-3.5">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-sm font-medium text-ink">
                        {run.kind} | {run.source} | {run.status}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {run.resume ? `简历：${run.resume.title}` : run.event ? `事件：${run.event.title}` : "已关联到当前岗位"}
                      </div>
                      {run.errorMessage ? <div className="mt-1 text-sm text-rose-600">{run.errorMessage}</div> : null}
                      <div className="mt-2">
                        <Link
                          href={`/agent-runs/${run.id}?back=job&jobId=${job.id}`}
                          className="text-sm text-accent underline-offset-4 hover:underline"
                        >
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

        <Panel title="危险操作" subtitle="删除后会同时清理这条岗位的申请记录和相关事件，且无法恢复。">
          <DeleteJobForm jobLeadId={job.id} redirectTo="/jobs" />
        </Panel>
      </div>
    </PageShell>
  );
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-panel px-4 py-3">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-1.5 text-sm text-ink">{children}</div>
    </div>
  );
}

function Field({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <label className="block text-sm text-slate-600">
      {label}
      <input
        name={name}
        defaultValue={defaultValue}
        className="mt-2 h-10 w-full rounded-xl border border-line bg-panel px-3.5 text-sm outline-none"
      />
    </label>
  );
}

function TextAreaField({
  label,
  name,
  defaultValue,
  rows
}: {
  label: string;
  name: string;
  defaultValue: string;
  rows: number;
}) {
  return (
    <label className="block text-sm text-slate-600">
      {label}
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={rows}
        className="mt-2 w-full rounded-2xl border border-line bg-panel px-3.5 py-3 text-sm leading-6 outline-none"
      />
    </label>
  );
}

function ProviderBadge({ provider }: { provider: string | null }) {
  const label = provider === "openai" ? "OpenAI" : provider === "external-agent" ? "外部 Agent" : "待确认";
  return <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{label}</span>;
}

function buildWorkspaceHref({
  workspaceView,
  query,
  status,
  city,
  source
}: {
  workspaceView: "table" | "board";
  query: string;
  status: string;
  city: string;
  source: string;
}) {
  const params = new URLSearchParams();

  if (workspaceView === "board") {
    params.set("view", "board");
  }
  if (query.trim()) {
    params.set("q", query.trim());
  }
  if (status.trim()) {
    params.set("status", status.trim());
  }
  if (city.trim()) {
    params.set("city", city.trim());
  }
  if (source.trim()) {
    params.set("source", source.trim());
  }

  const suffix = params.toString();
  return suffix ? `/jobs?${suffix}` : "/jobs";
}

function buildJobTitle(companyName: string, roleTitle: string) {
  const company = companyName.trim();
  const role = roleTitle.trim();
  if (!company) return role || "岗位详情";
  if (!role) return company;
  return `${company} · ${role}`;
}
