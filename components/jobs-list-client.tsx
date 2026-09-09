"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent, type RefObject } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ApplicationStage } from "@prisma/client";
import { updateApplicationStage, updateJobLinkedResumeVariant } from "@/app/actions";
import { Badge } from "@/components/cards";
import { DeleteJobForm } from "@/components/delete-job-form";
import { formatDate } from "@/lib/format";
import { getStageDisplayLabel, normalizeApplicationStage, stageOptions } from "@/lib/constants";

type JobItem = {
  id: string;
  companyName: string;
  roleTitle: string;
  city: string | null;
  seniority: string | null;
  sourceName: string | null;
  parsedSummary: string | null;
  rawContent: string;
  needsReview: boolean;
  skills: string;
  status: ApplicationStage;
  updatedAt: Date;
  application: {
    id: string;
    currentStage: ApplicationStage;
    submissionChannel: string | null;
    nextAction: string | null;
    note: string | null;
    updatedAt: Date;
  } | null;
  resumeVariants: Array<{
    id: string;
    title: string;
    note: string | null;
    jobLeadId: string | null;
    resume: {
      id: string;
      title: string;
    };
  }>;
  linkedResumeVariant: {
    optionId: string;
    title: string;
    href: string;
    resumeId: string;
  } | null;
};

type ResumeVariantOption = {
  optionId: string;
  kind: "resume" | "variant";
  title: string;
  resumeId: string;
  resumeTitle: string;
  jobLeadId: string | null;
  jobLabel: string | null;
};

const statusOptions: Array<{ value: "ALL" | ApplicationStage; label: string }> = [
  { value: "ALL", label: "全部状态" },
  ...stageOptions
];

const CUSTOM_STAGE_ACTIVE = "__CUSTOM_STAGE_ACTIVE__";
const CUSTOM_STAGE_NEW = "__CUSTOM_STAGE_NEW__";

export function JobsListClient({
  jobs,
  resumeVariantOptions,
  initialView = "table",
  initialQuery = "",
  initialStatus = "ALL",
  initialCity = "ALL",
  initialSource = "ALL"
}: {
  jobs: JobItem[];
  resumeVariantOptions: ResumeVariantOption[];
  initialView?: "table" | "board";
  initialQuery?: string;
  initialStatus?: string;
  initialCity?: string;
  initialSource?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState<"ALL" | ApplicationStage>(parseStageFilter(initialStatus));
  const [city, setCity] = useState(initialCity);
  const [source, setSource] = useState(initialSource);
  const [view, setView] = useState<"table" | "board">(initialView);
  const [items, setItems] = useState(jobs);
  const [savingApplicationIds, setSavingApplicationIds] = useState<string[]>([]);
  const [savingLinkedJobIds, setSavingLinkedJobIds] = useState<string[]>([]);
  const [draggingJobId, setDraggingJobId] = useState<string | null>(null);
  const [dropStageValue, setDropStageValue] = useState<ApplicationStage | null>(null);

  const cityOptions = useMemo(() => buildOptions(items.map((job) => job.city || "地点待确认")), [items]);
  const sourceOptions = useMemo(() => buildOptions(items.map((job) => job.sourceName || "主动导入")), [items]);

  const filteredJobs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return items.filter((job) => {
      const stage = normalizeApplicationStage(job.application?.currentStage || job.status);
      const jobCity = job.city || "地点待确认";
      const jobSource = job.sourceName || "主动导入";
      const jobChannel = job.application?.submissionChannel || "";
      const customStageLabel = job.application?.nextAction || "";
      const matchesStatus = status === "ALL" ? true : stage === status;
      const matchesCity = city === "ALL" ? true : jobCity === city;
      const matchesSource = source === "ALL" ? true : jobSource === source;
      const haystack = [
        job.companyName,
        job.roleTitle,
        jobCity,
        jobChannel,
        jobSource,
        job.seniority || "",
        job.parsedSummary || "",
        job.rawContent || "",
        job.application?.note || "",
        customStageLabel
      ]
        .join(" ")
        .toLowerCase();
      const matchesQuery = normalizedQuery ? haystack.includes(normalizedQuery) : true;

      return matchesStatus && matchesCity && matchesSource && matchesQuery;
    });
  }, [items, query, status, city, source]);

  function handleDeleted(jobLeadId: string) {
    setItems((current) => current.filter((job) => job.id !== jobLeadId));
  }

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());

    setOrDeleteParam(params, "view", view === "board" ? "board" : "");
    setOrDeleteParam(params, "q", query.trim());
    setOrDeleteParam(params, "status", status !== "ALL" ? status : "");
    setOrDeleteParam(params, "city", city !== "ALL" ? city : "");
    setOrDeleteParam(params, "source", source !== "ALL" ? source : "");

    const nextQuery = params.toString();
    const currentQuery = searchParams.toString();

    if (nextQuery !== currentQuery) {
      router.replace(nextQuery ? pathname + "?" + nextQuery : pathname, { scroll: false });
    }
  }, [city, pathname, query, router, searchParams, source, status, view]);

  async function handleApplicationSaved(formData: FormData) {
    const applicationId = String(formData.get("applicationId") || "");
    const stage = formData.get("stage") as ApplicationStage | null;
    const submissionChannel = String(formData.get("submissionChannel") || "");
    const nextAction = String(formData.get("nextAction") || "");
    const note = String(formData.get("note") || "");

    if (!applicationId || !stage) {
      return;
    }

    setSavingApplicationIds((current) => [...current, applicationId]);

    try {
      await updateApplicationStage(formData);

      setItems((current) =>
        current.map((job) =>
          job.application?.id === applicationId
            ? {
                ...job,
                status: stage,
                updatedAt: new Date(),
                application: {
                  ...job.application,
                  currentStage: stage,
                  submissionChannel: submissionChannel || null,
                  nextAction: nextAction || null,
                  note,
                  updatedAt: new Date()
                }
              }
            : job
        )
      );
    } finally {
      setSavingApplicationIds((current) => current.filter((id) => id !== applicationId));
    }
  }

  async function handleApplicationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await handleApplicationSaved(formData);
  }

  async function handleBoardStageDrop(job: JobItem, nextStage: ApplicationStage) {
    if (!job.application) {
      return;
    }

    const currentStage = normalizeApplicationStage(job.application.currentStage || job.status);

    if (currentStage === nextStage) {
      return;
    }

    const formData = new FormData();
    formData.set("applicationId", job.application.id);
    formData.set("stage", nextStage);
    formData.set("submissionChannel", job.application.submissionChannel || "");
    formData.set("nextAction", job.application.nextAction || "");
    formData.set("note", job.application.note || "");

    await handleApplicationSaved(formData);
  }

  async function handleLinkedResumeSaved(jobLeadId: string, linkedResumeOptionId: string) {
    setSavingLinkedJobIds((current) => [...current, jobLeadId]);

    try {
      const formData = new FormData();
      formData.set("jobLeadId", jobLeadId);
      formData.set("linkedResumeOptionId", linkedResumeOptionId);
      await updateJobLinkedResumeVariant(formData);

      const nextVariant = resumeVariantOptions.find((variant) => variant.optionId === linkedResumeOptionId) || null;

      setItems((current) =>
        current.map((job) =>
          job.id === jobLeadId
            ? {
                ...job,
                linkedResumeVariant: nextVariant
                  ? {
                      optionId: nextVariant.optionId,
                      title: nextVariant.title,
                      resumeId: nextVariant.resumeId,
                      href:
                        nextVariant.kind === "resume"
                          ? "/resumes#resume-" + nextVariant.resumeId
                          : "/resumes#variant-" + nextVariant.optionId.replace("variant:", "")
                    }
                  : null
              }
            : job
        )
      );
    } finally {
      setSavingLinkedJobIds((current) => current.filter((id) => id !== jobLeadId));
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2.5 xl:grid-cols-[minmax(240px,1.35fr)_140px_140px_160px_148px]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索岗位、公司、Base、渠道、来源或备注"
          className="h-10 w-full rounded-xl border border-line bg-white px-3.5 text-sm outline-none"
        />
        <select
          value={status}
          onChange={(event) => setStatus(parseStageFilter(event.target.value))}
          className="h-10 w-full rounded-xl border border-line bg-white px-3.5 text-sm outline-none"
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={city}
          onChange={(event) => setCity(event.target.value)}
          className="h-10 w-full rounded-xl border border-line bg-white px-3.5 text-sm outline-none"
        >
          <option value="ALL">全部 Base</option>
          {cityOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <select
          value={source}
          onChange={(event) => setSource(event.target.value)}
          className="h-10 w-full rounded-xl border border-line bg-white px-3.5 text-sm outline-none"
        >
          <option value="ALL">全部来源</option>
          {sourceOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <div className="grid h-10 grid-cols-2 rounded-xl border border-line bg-white p-1 text-sm">
          <button
            type="button"
            onClick={() => setView("table")}
            className={"rounded-lg px-3 py-1.5 font-medium " + (view === "table" ? "bg-ink text-white" : "text-slate-600")}
          >
            表格
          </button>
          <button
            type="button"
            onClick={() => setView("board")}
            className={"rounded-lg px-3 py-1.5 font-medium " + (view === "board" ? "bg-ink text-white" : "text-slate-600")}
          >
            看板
          </button>
        </div>
      </div>

      {view === "table" ? (
        <JobsTable
          jobs={filteredJobs}
          resumeVariantOptions={resumeVariantOptions}
          onDeleted={handleDeleted}
          onApplicationSubmit={handleApplicationSubmit}
          onLinkedResumeSaved={handleLinkedResumeSaved}
          savingApplicationIds={savingApplicationIds}
          savingLinkedJobIds={savingLinkedJobIds}
          workspaceView={view}
          query={query}
          status={status}
          city={city}
          source={source}
        />
      ) : (
        <JobsBoard
          jobs={filteredJobs}
          resumeVariantOptions={resumeVariantOptions}
          onDeleted={handleDeleted}
          onApplicationSubmit={handleApplicationSubmit}
          onLinkedResumeSaved={handleLinkedResumeSaved}
          savingApplicationIds={savingApplicationIds}
          savingLinkedJobIds={savingLinkedJobIds}
          onStageDrop={handleBoardStageDrop}
          draggingJobId={draggingJobId}
          dropStageValue={dropStageValue}
          onDragStart={setDraggingJobId}
          onDragEnd={() => {
            setDraggingJobId(null);
            setDropStageValue(null);
          }}
          onStageHover={setDropStageValue}
          workspaceView={view}
          query={query}
          status={status}
          city={city}
          source={source}
        />
      )}
    </div>
  );
}

function JobsTable({
  jobs,
  resumeVariantOptions,
  onDeleted,
  onApplicationSubmit,
  onLinkedResumeSaved,
  savingApplicationIds,
  savingLinkedJobIds,
  workspaceView,
  query,
  status,
  city,
  source
}: {
  jobs: JobItem[];
  resumeVariantOptions: ResumeVariantOption[];
  onDeleted: (jobLeadId: string) => void;
  onApplicationSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onLinkedResumeSaved: (jobLeadId: string, linkedResumeOptionId: string) => Promise<void>;
  savingApplicationIds: string[];
  savingLinkedJobIds: string[];
  workspaceView: "table" | "board";
  query: string;
  status: "ALL" | ApplicationStage;
  city: string;
  source: string;
}) {
  if (jobs.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="overflow-x-auto rounded-3xl border border-line bg-white shadow-card">
      <div className="min-w-full w-max">
        <div className="sticky top-0 z-10 grid grid-cols-[280px_148px_132px_150px_156px_236px_120px_124px_112px_220px] border-b border-line bg-slate-50 px-3 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
          <div className="sticky left-0 z-20 -ml-3 border-r border-line bg-slate-50 pl-3 pr-4">岗位</div>
          <div>Base</div>
          <div>投递渠道</div>
          <div>推进情况</div>
          <div>关联简历</div>
          <div>备注</div>
          <div>来源</div>
          <div>更新</div>
          <div>原始内容</div>
          <div className="sticky right-0 z-20 flex items-center justify-center border-l border-line bg-slate-50 px-3 text-center">
            操作
          </div>
        </div>

        <div className="divide-y divide-line">
          {jobs.map((job) => (
            <JobTableRow
              key={job.id}
              job={job}
              resumeVariantOptions={resumeVariantOptions}
              onDeleted={onDeleted}
              onApplicationSubmit={onApplicationSubmit}
              onLinkedResumeSaved={onLinkedResumeSaved}
              saving={job.application ? savingApplicationIds.includes(job.application.id) : false}
              savingLinkedResume={savingLinkedJobIds.includes(job.id)}
              workspaceView={workspaceView}
              query={query}
              status={status}
              city={city}
              source={source}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function JobTableRow({
  job,
  resumeVariantOptions,
  onDeleted,
  onApplicationSubmit,
  onLinkedResumeSaved,
  saving,
  savingLinkedResume,
  workspaceView,
  query,
  status,
  city,
  source
}: {
  job: JobItem;
  resumeVariantOptions: ResumeVariantOption[];
  onDeleted: (jobLeadId: string) => void;
  onApplicationSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onLinkedResumeSaved: (jobLeadId: string, linkedResumeOptionId: string) => Promise<void>;
  saving: boolean;
  savingLinkedResume: boolean;
  workspaceView: "table" | "board";
  query: string;
  status: "ALL" | ApplicationStage;
  city: string;
  source: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  if (!job.application) {
    return (
      <div className="grid grid-cols-[280px_148px_132px_150px_156px_236px_120px_124px_112px_220px] items-center px-3 py-2.5 text-sm">
        <div className="sticky left-0 z-10 -ml-3 min-w-0 border-r border-line bg-white pl-3 pr-4">
          <div className="flex items-center gap-2">
            <Link
              href={buildJobDetailHref(job.id, workspaceView, query, status, city, source)}
              className="truncate font-semibold text-ink underline-offset-4 hover:underline"
            >
              {job.roleTitle}
            </Link>
            <span className="truncate text-sm text-slate-500">{job.companyName}</span>
            {job.needsReview ? <Badge>待确认</Badge> : null}
          </div>
        </div>
        <div className="truncate pr-4 text-slate-600">
          {job.city || "待确认"}
          {job.seniority ? <span className="text-slate-400"> / {job.seniority}</span> : null}
        </div>
        <div className="truncate pr-4 text-slate-400">未设置</div>
        <div className="truncate pr-4 text-slate-500">{getStageDisplayLabel(job.status)}</div>
        <div className="pr-5">
          <LinkedResumeField
            job={job}
            resumeVariantOptions={resumeVariantOptions}
            onLinkedResumeSaved={onLinkedResumeSaved}
            saving={savingLinkedResume}
          />
        </div>
        <div className="pr-5 text-slate-400">-</div>
        <div className="truncate pr-4 text-sm text-slate-600">{job.sourceName || "主动导入"}</div>
        <div className="pr-4 text-xs text-slate-500">{formatDate(job.updatedAt)}</div>
        <div className="pr-4">
          <Link href={"/jobs/" + job.id + "/source"} className="text-sm text-accent underline-offset-4 hover:underline">
            查看导入原文
          </Link>
        </div>
        <div className="sticky right-0 z-10 flex justify-center border-l border-line bg-white px-3">
          <JobActionButtons job={job} onDeleted={onDeleted} />
        </div>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={onApplicationSubmit}
      className="grid grid-cols-[280px_148px_132px_150px_156px_236px_120px_124px_112px_220px] items-center px-3 py-2.5 text-sm"
    >
      <input type="hidden" name="applicationId" value={job.application.id} />

      <div className="sticky left-0 z-10 -ml-3 min-w-0 border-r border-line bg-white pl-3 pr-4">
        <div className="flex items-center gap-2">
          <Link
            href={buildJobDetailHref(job.id, workspaceView, query, status, city, source)}
            className="truncate font-semibold text-ink underline-offset-4 hover:underline"
          >
            {job.roleTitle}
          </Link>
          <span className="truncate text-sm text-slate-500">{job.companyName}</span>
          {job.needsReview ? <Badge>待确认</Badge> : null}
        </div>
      </div>

      <div className="truncate pr-4 text-slate-600">
        {job.city || "待确认"}
          {job.seniority ? <span className="text-slate-400"> / {job.seniority}</span> : null}
      </div>

      <div className="pr-4">
        <input
          name="submissionChannel"
          defaultValue={job.application.submissionChannel || ""}
          placeholder="例如：官网 / Boss / 内推"
          onBlur={() => formRef.current?.requestSubmit()}
          className="h-8 w-full rounded-xl border border-line bg-panel px-3 text-sm outline-none"
        />
      </div>

      <div className="pr-4">
        <StageSelectField
          formRef={formRef}
          currentStage={job.application.currentStage}
          currentCustomStatus={job.application.nextAction}
        />
      </div>

      <div className="pr-5">
        <LinkedResumeField
          job={job}
          resumeVariantOptions={resumeVariantOptions}
          onLinkedResumeSaved={onLinkedResumeSaved}
          saving={savingLinkedResume}
        />
      </div>

      <div className="pr-5">
        <NoteInlineEditor
          formRef={formRef}
          name="note"
          defaultValue={job.application.note || ""}
          placeholder="手动备注面试安排、联系人、个人判断等"
        />
      </div>

      <div className="truncate pr-4 text-sm text-slate-600">{job.sourceName || "主动导入"}</div>

      <div className="pr-4 text-xs text-slate-500">
        <span>{formatDate(job.updatedAt)}</span>
        {saving ? <div className="mt-1 text-xs text-slate-400">保存中...</div> : null}
      </div>
      <div className="pr-4">
        <Link href={"/jobs/" + job.id + "/source"} className="text-sm text-accent underline-offset-4 hover:underline">
          查看导入原文
        </Link>
      </div>
      <div className="sticky right-0 z-10 flex justify-center border-l border-line bg-white px-3">
        <JobActionButtons job={job} onDeleted={onDeleted} />
      </div>
    </form>
  );
}

function JobsBoard({
  jobs,
  resumeVariantOptions,
  onDeleted,
  onApplicationSubmit,
  onLinkedResumeSaved,
  savingApplicationIds,
  savingLinkedJobIds,
  onStageDrop,
  draggingJobId,
  dropStageValue,
  onDragStart,
  onDragEnd,
  onStageHover,
  workspaceView,
  query,
  status,
  city,
  source
}: {
  jobs: JobItem[];
  resumeVariantOptions: ResumeVariantOption[];
  onDeleted: (jobLeadId: string) => void;
  onApplicationSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onLinkedResumeSaved: (jobLeadId: string, linkedResumeOptionId: string) => Promise<void>;
  savingApplicationIds: string[];
  savingLinkedJobIds: string[];
  onStageDrop: (job: JobItem, nextStage: ApplicationStage) => Promise<void>;
  draggingJobId: string | null;
  dropStageValue: ApplicationStage | null;
  onDragStart: (jobId: string) => void;
  onDragEnd: () => void;
  onStageHover: (stage: ApplicationStage | null) => void;
  workspaceView: "table" | "board";
  query: string;
  status: "ALL" | ApplicationStage;
  city: string;
  source: string;
}) {
  if (jobs.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="grid gap-3 xl:grid-cols-4 2xl:grid-cols-5">
      {stageOptions.map((stage) => {
        const stageJobs = jobs.filter(
          (job) => normalizeApplicationStage(job.application?.currentStage || job.status) === stage.value
        );
        const isDropTarget = dropStageValue === stage.value;

        return (
          <section
            key={stage.value}
            onDragOver={(event) => {
              event.preventDefault();
              if (draggingJobId) {
                onStageHover(stage.value);
              }
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                onStageHover(null);
              }
            }}
            onDrop={async (event) => {
              event.preventDefault();
              const droppedJobId = event.dataTransfer.getData("text/job-id");
              const droppedJob = jobs.find((job) => job.id === droppedJobId);
              onStageHover(null);
              onDragEnd();

              if (!droppedJob) {
                return;
              }

              await onStageDrop(droppedJob, stage.value);
            }}
            className={
              "min-h-[220px] rounded-3xl border bg-white p-2.5 shadow-card transition-colors " +
              (isDropTarget ? "border-accent bg-accentSoft/40" : "border-line")
            }
          >
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <div className="font-semibold text-ink">{stage.label}</div>
              <Badge>{stageJobs.length}</Badge>
            </div>
            <div className="space-y-2.5">
              {stageJobs.map((job) => (
                <JobBoardCard
                  key={job.id}
                  job={job}
                  resumeVariantOptions={resumeVariantOptions}
                  onDeleted={onDeleted}
                  onApplicationSubmit={onApplicationSubmit}
                  onLinkedResumeSaved={onLinkedResumeSaved}
                  saving={job.application ? savingApplicationIds.includes(job.application.id) : false}
                  savingLinkedResume={savingLinkedJobIds.includes(job.id)}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  isDragging={draggingJobId === job.id}
                  workspaceView={workspaceView}
                  query={query}
                  status={status}
                  city={city}
                  source={source}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function JobBoardCard({
  job,
  resumeVariantOptions,
  onDeleted,
  onApplicationSubmit,
  onLinkedResumeSaved,
  saving,
  savingLinkedResume,
  onDragStart,
  onDragEnd,
  isDragging,
  workspaceView,
  query,
  status,
  city,
  source
}: {
  job: JobItem;
  resumeVariantOptions: ResumeVariantOption[];
  onDeleted: (jobLeadId: string) => void;
  onApplicationSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onLinkedResumeSaved: (jobLeadId: string, linkedResumeOptionId: string) => Promise<void>;
  saving: boolean;
  savingLinkedResume: boolean;
  onDragStart: (jobId: string) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  workspaceView: "table" | "board";
  query: string;
  status: "ALL" | ApplicationStage;
  city: string;
  source: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      onSubmit={onApplicationSubmit}
      draggable={Boolean(job.application)}
      onDragStart={(event) => {
        if (!job.application) {
          event.preventDefault();
          return;
        }

        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/job-id", job.id);
        onDragStart(job.id);
      }}
      onDragEnd={onDragEnd}
      className={"rounded-2xl border border-line bg-panel p-2.5 transition-opacity " + (isDragging ? "opacity-45" : "")}
    >
      {job.application ? <input type="hidden" name="applicationId" value={job.application.id} /> : null}

      <Link
        href={buildJobDetailHref(job.id, workspaceView, query, status, city, source)}
        className="font-medium text-ink underline-offset-4 hover:underline"
      >
        {job.roleTitle}
      </Link>
      <div className="mt-1 text-sm text-slate-500">{job.companyName}</div>
      <div className="mt-1.5 text-xs text-slate-500">
        {job.city || "待确认"} | {job.sourceName || "主动导入"}
      </div>

      <div className="mt-2.5">
        <LinkedResumeField
          job={job}
          resumeVariantOptions={resumeVariantOptions}
          onLinkedResumeSaved={onLinkedResumeSaved}
          saving={savingLinkedResume}
          compact
        />
      </div>
      <div className="mt-2.5">
        <Link href={"/jobs/" + job.id + "/source"} className="text-sm text-accent underline-offset-4 hover:underline">
          查看导入原文
        </Link>
      </div>

      {job.application ? (
        <>
          <input
            name="submissionChannel"
            defaultValue={job.application.submissionChannel || ""}
            placeholder="投递渠道"
            onBlur={() => formRef.current?.requestSubmit()}
            className="mt-2.5 h-9 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none"
          />
          <div className="mt-2.5">
            <NoteInlineEditor formRef={formRef} name="note" defaultValue={job.application.note || ""} placeholder="备注" compact />
          </div>
          <div className="mt-2.5">
            <StageSelectField
              formRef={formRef}
              currentStage={job.application.currentStage}
              currentCustomStatus={job.application.nextAction}
              compact
            />
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {saving ? <span className="text-xs text-slate-400">自动保存中...</span> : null}
            <DeleteJobForm jobLeadId={job.id} onDeleted={onDeleted} />
          </div>
        </>
      ) : (
        <div className="mt-3">
          <DeleteJobForm jobLeadId={job.id} onDeleted={onDeleted} />
        </div>
      )}
    </form>
  );
}

function LinkedResumeField({
  job,
  resumeVariantOptions,
  onLinkedResumeSaved,
  saving,
  compact = false
}: {
  job: JobItem;
  resumeVariantOptions: ResumeVariantOption[];
  onLinkedResumeSaved: (jobLeadId: string, linkedResumeOptionId: string) => Promise<void>;
  saving: boolean;
  compact?: boolean;
}) {
  const currentValue = job.linkedResumeVariant?.optionId || "";
  const selectableVariants = resumeVariantOptions.filter(
    (variant) =>
      variant.kind === "resume" || !variant.jobLeadId || variant.jobLeadId === job.id || variant.optionId === currentValue
  );

  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        {job.linkedResumeVariant ? (
          <Link href={job.linkedResumeVariant.href} className="block truncate text-sm text-accent underline-offset-4 hover:underline">
            {job.linkedResumeVariant.title}
          </Link>
        ) : (
          <div className="truncate text-sm text-slate-400">{saving ? "保存中..." : "暂未关联"}</div>
        )}
      </div>
      <select
        value={currentValue}
        onChange={(event) => {
          if (!event.target.value) {
            return;
          }

          void onLinkedResumeSaved(job.id, event.target.value);
        }}
        disabled={saving || selectableVariants.length === 0}
        aria-label="选择关联简历版本"
        className={
          (compact ? "h-9 bg-white" : "h-8 bg-panel") +
          " w-[132px] shrink-0 rounded-xl border border-line px-3 text-sm outline-none"
        }
      >
        <option value="">{selectableVariants.length > 0 ? "选择版本" : "暂无版本"}</option>
        {selectableVariants.map((variant) => (
          <option key={variant.optionId} value={variant.optionId}>
            {buildResumeVariantOptionLabel(variant)}
          </option>
        ))}
      </select>
    </div>
  );
}

function JobActionButtons({
  job,
  onDeleted
}: {
  job: JobItem;
  onDeleted: (jobLeadId: string) => void;
}) {
  const tailorHref =
    "/tailor?jobLeadId=" +
    encodeURIComponent(job.id) +
    (job.linkedResumeVariant?.resumeId ? "&resumeId=" + encodeURIComponent(job.linkedResumeVariant.resumeId) : "");

  return (
    <div className="flex items-center justify-end gap-2">
      <Link
        href={tailorHref}
        className="inline-flex h-8 min-w-[84px] items-center justify-center rounded-lg border border-line bg-white px-3 text-xs font-medium text-ink"
      >
        去微调
      </Link>
      <DeleteJobForm jobLeadId={job.id} onDeleted={onDeleted} />
    </div>
  );
}

function NoteInlineEditor({
  formRef,
  name,
  defaultValue,
  placeholder,
  compact = false
}: {
  formRef: RefObject<HTMLFormElement | null>;
  name: string;
  defaultValue: string;
  placeholder: string;
  compact?: boolean;
}) {
  const preview = defaultValue.trim() || placeholder;
  const detailsRef = useRef<HTMLDetailsElement>(null);

  return (
    <details ref={detailsRef} className="group w-full">
      <summary className="flex h-8 cursor-pointer list-none items-center rounded-xl border border-line bg-panel px-3 text-sm outline-none group-open:hidden">
        <span className={"block w-full truncate " + (defaultValue.trim() ? "text-slate-700" : "text-slate-400")}>{preview}</span>
      </summary>
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={compact ? 3 : 4}
        placeholder={placeholder}
        onBlur={() => {
          formRef.current?.requestSubmit();
          if (detailsRef.current) {
            detailsRef.current.open = false;
          }
        }}
        className="mt-2 w-full resize-none rounded-xl border border-line bg-panel px-3 py-2 text-sm leading-5 outline-none"
      />
    </details>
  );
}

function StageSelectField({
  formRef,
  currentStage,
  currentCustomStatus,
  compact = false
}: {
  formRef: RefObject<HTMLFormElement | null>;
  currentStage: ApplicationStage;
  currentCustomStatus: string | null;
  compact?: boolean;
}) {
  const [stageValue, setStageValue] = useState<ApplicationStage>(normalizeApplicationStage(currentStage));
  const [customStatus, setCustomStatus] = useState(currentCustomStatus?.trim() || "");
  const stageInputRef = useRef<HTMLInputElement>(null);
  const nextActionInputRef = useRef<HTMLInputElement>(null);
  const selectedValue = customStatus ? CUSTOM_STAGE_ACTIVE : stageValue;

  function submitCurrentState(nextStage: ApplicationStage, nextCustomStatus: string) {
    if (stageInputRef.current) {
      stageInputRef.current.value = nextStage;
    }

    if (nextActionInputRef.current) {
      nextActionInputRef.current.value = nextCustomStatus;
    }

    requestAnimationFrame(() => {
      formRef.current?.requestSubmit();
    });
  }

  function handleChange(value: string) {
    if (value === CUSTOM_STAGE_NEW) {
      const nextLabel = window.prompt("请输入其他推进状态", customStatus || "");
      const trimmed = nextLabel?.trim();

      if (!trimmed) {
        return;
      }

      const confirmed = window.confirm("将推进状态更新为“" + trimmed + "”吗？");

      if (!confirmed) {
        return;
      }

      setCustomStatus(trimmed);
      submitCurrentState(stageValue, trimmed);
      return;
    }

    if (value === CUSTOM_STAGE_ACTIVE) {
      return;
    }

    setStageValue(value as ApplicationStage);
    if (customStatus) {
      setCustomStatus("");
    }
    submitCurrentState(value as ApplicationStage, "");
  }

  return (
    <>
      <input ref={stageInputRef} type="hidden" name="stage" value={stageValue} readOnly />
      <input ref={nextActionInputRef} type="hidden" name="nextAction" value={customStatus} readOnly />
      <select
        value={selectedValue}
        onChange={(event) => handleChange(event.target.value)}
        className={(compact ? "h-9 bg-white" : "h-8 bg-panel") + " w-full rounded-xl border border-line px-3 text-sm outline-none"}
      >
        {stageOptions.map((stage) => (
          <option key={stage.value} value={stage.value}>
            {stage.label}
          </option>
        ))}
        {customStatus ? <option value={CUSTOM_STAGE_ACTIVE}>其他：{customStatus}</option> : null}
        <option value={CUSTOM_STAGE_NEW}>其他状态...</option>
      </select>
    </>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-line bg-white p-6 text-center text-sm text-slate-500">
      当前筛选条件下还没有岗位记录。
    </div>
  );
}

function buildResumeVariantOptionLabel(variant: ResumeVariantOption) {
  const base = variant.title.trim() || variant.resumeTitle.trim() || "未命名版本";
  const jobLabel = variant.jobLabel ? " · " + variant.jobLabel : "";
  if (variant.kind === "resume") {
    return base + " · 原始版本";
  }
  return base + " · " + variant.resumeTitle + jobLabel;
}

function parseStageFilter(value: string) {
  return value === "ALL" ? "ALL" : (value as ApplicationStage);
}

function buildOptions(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function setOrDeleteParam(params: URLSearchParams, key: string, value: string) {
  if (value) {
    params.set(key, value);
  } else {
    params.delete(key);
  }
}

function buildJobDetailHref(
  jobId: string,
  workspaceView: "table" | "board",
  query: string,
  status: "ALL" | ApplicationStage,
  city: string,
  source: string
) {
  const params = new URLSearchParams();
  params.set("workspaceView", workspaceView);
  if (query.trim()) params.set("q", query.trim());
  if (status !== "ALL") params.set("status", status);
  if (city !== "ALL") params.set("city", city);
  if (source !== "ALL") params.set("source", source);

  const queryString = params.toString();
  return queryString ? "/jobs/" + jobId + "?" + queryString : "/jobs/" + jobId;
}
