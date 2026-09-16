"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ApplicationStage } from "@prisma/client";
import { updateApplicationStage } from "@/app/actions";
import { Badge } from "@/components/cards";
import { getStageDisplayLabel, normalizeApplicationStage, stageOptions } from "@/lib/constants";
import { getCurrentJobItem } from "@/lib/job-current-item";

type JobItem = {
  id: string; companyName: string; roleTitle: string; city: string | null; seniority: string | null;
  sourceName: string | null; parsedSummary: string | null; rawContent: string; needsReview: boolean;
  skills: string; status: ApplicationStage; updatedAt: Date;
  application: { id: string; currentStage: ApplicationStage; submissionChannel: string | null; nextAction: string | null; note: string | null; updatedAt: Date; events: Array<{ eventType: string; title: string; eventTime: Date | null; createdAt: Date }> } | null;
};

export function JobsListClient({ jobs, initialView = "table", initialQuery = "", initialStatus = "ALL", initialCity = "ALL", initialSource = "ALL" }: {
  jobs: JobItem[]; initialView?: "table" | "board"; initialQuery?: string; initialStatus?: string; initialCity?: string; initialSource?: string;
}) {
  const router = useRouter(); const pathname = usePathname(); const searchParams = useSearchParams();
  const [items, setItems] = useState(jobs); const [query, setQuery] = useState(initialQuery); const [status, setStatus] = useState(initialStatus); const [city, setCity] = useState(initialCity); const [source, setSource] = useState(initialSource); const [view, setView] = useState<"table" | "board">(initialView); const [draggedJobId, setDraggedJobId] = useState<string | null>(null); const [dropStage, setDropStage] = useState<ApplicationStage | null>(null); const [moveError, setMoveError] = useState<string | null>(null); const [nextActionError, setNextActionError] = useState<string | null>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null); const secondaryScrollRef = useRef<HTMLDivElement>(null); const [tableMetrics, setTableMetrics] = useState({ left: 0, viewportWidth: 0, scrollWidth: 0 }); const [hasHorizontalOverflow, setHasHorizontalOverflow] = useState(false);
  const cities = useMemo(() => options(items.map((job) => job.city || "地点待确认")), [items]);
  const sources = useMemo(() => options(items.map((job) => job.sourceName || "主动导入")), [items]);
  const filtered = useMemo(() => items.filter((job) => {
    const stage = normalizeApplicationStage(job.application?.currentStage || job.status);
    const haystack = [job.companyName, job.roleTitle, job.city, job.sourceName, job.application?.submissionChannel, job.application?.nextAction, job.application?.note, job.parsedSummary, job.skills].join(" ").toLowerCase();
    return (!query.trim() || haystack.includes(query.trim().toLowerCase())) && (status === "ALL" || stage === status) && (city === "ALL" || (job.city || "地点待确认") === city) && (source === "ALL" || (job.sourceName || "主动导入") === source);
  }), [items, query, status, city, source]);

  useEffect(() => { const params = new URLSearchParams(searchParams.toString()); setParam(params, "view", view === "board" ? "board" : ""); setParam(params, "q", query.trim()); setParam(params, "status", status === "ALL" ? "" : status); setParam(params, "city", city === "ALL" ? "" : city); setParam(params, "source", source === "ALL" ? "" : source); const next = params.toString(); if (next !== searchParams.toString()) router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false }); }, [city, pathname, query, router, searchParams, source, status, view]);

  useEffect(() => {
    if (view !== "table") return;
    const table = tableScrollRef.current;
    if (!table) return;
    const measure = () => { const bounds = table.getBoundingClientRect(); setTableMetrics({ left: bounds.left, viewportWidth: table.clientWidth, scrollWidth: table.scrollWidth }); setHasHorizontalOverflow(table.scrollWidth > table.clientWidth); };
    measure();
    const observer = new ResizeObserver(measure); observer.observe(table);
    return () => observer.disconnect();
  }, [filtered.length, view]);

  const syncScroll = (source: "table" | "secondary") => {
    const from = source === "table" ? tableScrollRef.current : secondaryScrollRef.current;
    const to = source === "table" ? secondaryScrollRef.current : tableScrollRef.current;
    if (from && to && to.scrollLeft !== from.scrollLeft) to.scrollLeft = from.scrollLeft;
  };

  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); const id = String(data.get("applicationId") || ""); const stage = data.get("stage") as ApplicationStage | null; if (!id || !stage) return; await updateApplicationStage(data); setItems((current) => current.map((job) => job.application?.id === id ? { ...job, status: stage, updatedAt: new Date(), application: { ...job.application, currentStage: stage, submissionChannel: data.has("submissionChannel") ? String(data.get("submissionChannel") || "") || null : job.application.submissionChannel, nextAction: data.has("nextAction") ? String(data.get("nextAction") || "") || null : job.application.nextAction, note: data.has("note") ? String(data.get("note") || "") || null : job.application.note, updatedAt: new Date() } } : job)); }
  async function saveNextAction(applicationId: string, stage: ApplicationStage, nextAction: string) {
    setNextActionError(null);
    const formData = new FormData();
    formData.set("applicationId", applicationId);
    formData.set("stage", stage);
    formData.set("nextAction", nextAction);
    try {
      await updateApplicationStage(formData);
      setItems((current) => current.map((job) => job.application?.id === applicationId ? { ...job, updatedAt: new Date(), application: { ...job.application, nextAction: nextAction.trim() || null, updatedAt: new Date() } } : job));
      return true;
    } catch {
      setNextActionError("保存当前事项失败，已恢复原内容。请稍后重试。");
      return false;
    }
  }
  async function moveCard(jobId: string, targetStage: ApplicationStage) {
    const job = items.find((item) => item.id === jobId);
    const application = job?.application;
    if (!job || !application || normalizeApplicationStage(application.currentStage) === targetStage) return;
    const previousStage = application.currentStage;
    setMoveError(null);
    setItems((current) => current.map((item) => item.id === jobId && item.application ? { ...item, status: targetStage, updatedAt: new Date(), application: { ...item.application, currentStage: targetStage, updatedAt: new Date() } } : item));
    try {
      const formData = new FormData();
      formData.set("applicationId", application.id);
      formData.set("stage", targetStage);
      await updateApplicationStage(formData);
      router.refresh();
    } catch {
      setItems((current) => current.map((item) => item.id === jobId && item.application ? { ...item, status: previousStage, application: { ...item.application, currentStage: previousStage } } : item));
      setMoveError("移动岗位失败，已恢复原阶段。请稍后重试。");
    }
  }

  function handleDragStart(event: DragEvent<HTMLAnchorElement>, jobId: string) { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", jobId); setDraggedJobId(jobId); setMoveError(null); }
  function handleDrop(event: DragEvent<HTMLElement>, targetStage: ApplicationStage) { event.preventDefault(); const jobId = event.dataTransfer.getData("text/plain") || draggedJobId; setDropStage(null); setDraggedJobId(null); if (jobId) void moveCard(jobId, targetStage); }

  return <div className="space-y-3"><div className="grid gap-2.5 xl:grid-cols-[minmax(220px,1.35fr)_140px_140px_160px_148px]"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索岗位、公司、进度、事件或下一步" className="h-10 w-full rounded-xl border border-line bg-white px-3.5 text-sm outline-none" /><select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-xl border border-line bg-white px-3 text-sm"><option value="ALL">全部进度</option>{stageOptions.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select><select value={city} onChange={(e) => setCity(e.target.value)} className="h-10 rounded-xl border border-line bg-white px-3 text-sm"><option value="ALL">全部 Base</option>{cities.map((x) => <option key={x}>{x}</option>)}</select><select value={source} onChange={(e) => setSource(e.target.value)} className="h-10 rounded-xl border border-line bg-white px-3 text-sm"><option value="ALL">全部来源</option>{sources.map((x) => <option key={x}>{x}</option>)}</select><div className="grid h-10 grid-cols-2 rounded-xl border border-line bg-white p-1 text-sm"><button onClick={() => setView("table")} className={view === "table" ? "rounded-lg bg-ink text-white" : "text-slate-600"}>列表</button><button onClick={() => setView("board")} className={view === "board" ? "rounded-lg bg-ink text-white" : "text-slate-600"}>看板</button></div></div>{moveError ? <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{moveError}</p> : null}{nextActionError ? <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{nextActionError}</p> : null}{filtered.length === 0 ? <EmptyState /> : view === "table" ? <><div ref={tableScrollRef} onScroll={() => syncScroll("table")} className="overflow-x-auto rounded-3xl border border-line bg-white shadow-card"><div className="min-w-[860px]"><div className="grid grid-cols-[44px_minmax(220px,1.1fr)_115px_150px_minmax(260px,1fr)] border-b border-line bg-slate-50 px-4 py-2 text-[11px] font-medium uppercase tracking-[.14em] text-slate-400"><div>#</div><div>岗位</div><div>Base</div><div>进度</div><div>当前事项</div></div>{filtered.map((job, index) => <JobRow key={job.id} job={job} index={index + 1} onSave={save} onSaveNextAction={saveNextAction} />)}</div></div>{hasHorizontalOverflow ? <div ref={secondaryScrollRef} onScroll={() => syncScroll("secondary")} style={{ left: tableMetrics.left, width: tableMetrics.viewportWidth }} className="fixed bottom-0 z-30 hidden overflow-x-auto border-t border-line bg-white/95 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] md:block"><div style={{ width: tableMetrics.scrollWidth }} className="h-4" /></div> : null}</> : <div className="grid gap-3 xl:grid-cols-4 2xl:grid-cols-5">{stageOptions.map((stage) => { const stageJobs = filtered.filter((job) => normalizeApplicationStage(job.application?.currentStage || job.status) === stage.value); const isDropTarget = dropStage === stage.value; return <section key={stage.value} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropStage(stage.value); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropStage((current) => current === stage.value ? null : current); }} onDrop={(event) => handleDrop(event, stage.value)} className={`min-h-[220px] rounded-3xl border p-3 shadow-card transition-colors ${isDropTarget ? "border-accent bg-accent/5" : "border-line bg-white"}`}><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold text-ink">{stage.label}</h2><Badge>{stageJobs.length}</Badge></div><div className="space-y-2">{stageJobs.map((job) => <JobCard key={job.id} job={job} isDragging={draggedJobId === job.id} onDragStart={handleDragStart} onDragEnd={() => { setDraggedJobId(null); setDropStage(null); }} />)}</div></section>; })}</div>}</div>;
}

function JobRow({ job, index, onSave, onSaveNextAction }: { job: JobItem; index: number; onSave: (e: FormEvent<HTMLFormElement>) => Promise<void>; onSaveNextAction: (applicationId: string, stage: ApplicationStage, nextAction: string) => Promise<boolean> }) { return <JobEditor job={job} index={index} onSave={onSave} onSaveNextAction={onSaveNextAction} className="grid min-h-[64px] grid-cols-[44px_minmax(220px,1.1fr)_115px_150px_minmax(260px,1fr)] items-center gap-0 border-b border-line px-4 py-2 text-sm" />; }
function JobCard({ job, isDragging, onDragStart, onDragEnd }: { job: JobItem; isDragging: boolean; onDragStart: (event: DragEvent<HTMLAnchorElement>, jobId: string) => void; onDragEnd: () => void }) { return <Link href={`/jobs/${job.id}`} draggable={Boolean(job.application)} onDragStart={(event) => onDragStart(event, job.id)} onDragEnd={onDragEnd} className={`block cursor-grab rounded-2xl border border-line bg-panel px-3 py-2.5 text-sm transition hover:border-slate-300 hover:shadow-sm active:cursor-grabbing ${isDragging ? "opacity-50" : ""}`}><div className="truncate font-semibold text-ink">{job.roleTitle}</div><div className="mt-1 truncate text-xs text-slate-500">{job.companyName}{job.city ? ` · ${job.city}` : ""}</div></Link>; }
function JobEditor({ job, index, onSave, onSaveNextAction, className }: { job: JobItem; index?: number; onSave: (e: FormEvent<HTMLFormElement>) => Promise<void>; onSaveNextAction: (applicationId: string, stage: ApplicationStage, nextAction: string) => Promise<boolean>; className: string }) {
  const ref = useRef<HTMLFormElement>(null); const app = job.application;
  const inputRef = useRef<HTMLInputElement>(null); const savingRef = useRef(false);
  const [isEditingNextAction, setIsEditingNextAction] = useState(false); const [draftNextAction, setDraftNextAction] = useState("");
  const controlClass = "h-10 w-full rounded-xl border border-line bg-white px-3 text-sm";
  const currentItem = getCurrentJobItem(app);
  useEffect(() => { if (isEditingNextAction) { inputRef.current?.focus(); inputRef.current?.select(); } }, [isEditingNextAction]);
  const startEditing = () => { if (!app) return; setDraftNextAction(app.nextAction ?? ""); setIsEditingNextAction(true); };
  const cancelEditing = () => { setDraftNextAction(app?.nextAction ?? ""); setIsEditingNextAction(false); };
  const saveEditing = async () => {
    if (!app || !isEditingNextAction || savingRef.current) return;
    savingRef.current = true;
    const saved = await onSaveNextAction(app.id, normalizeApplicationStage(app.currentStage), draftNextAction);
    savingRef.current = false;
    if (saved) setIsEditingNextAction(false); else cancelEditing();
  };
  const submit = (event: FormEvent<HTMLFormElement>) => { if (!isEditingNextAction) return onSave(event); event.preventDefault(); void saveEditing(); };
  return <form ref={ref} onSubmit={submit} className={className}>{app ? <input type="hidden" name="applicationId" value={app.id} /> : null}<div className="tabular-nums text-xs text-slate-400">{index}</div><div className="min-w-0"><Link href={`/jobs/${job.id}`} className="block truncate font-semibold text-ink underline-offset-4 hover:underline">{job.roleTitle}</Link><div className="mt-1 truncate text-slate-500">{job.companyName}{job.needsReview ? <Badge>待确认</Badge> : null}</div></div><div className="truncate text-slate-600">{job.city || "待确认"}</div><div>{app ? <select name="stage" defaultValue={normalizeApplicationStage(app.currentStage)} onChange={() => ref.current?.requestSubmit()} className={controlClass}>{stageOptions.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select> : <span className="text-slate-500">{getStageDisplayLabel(job.status)}</span>}</div><div className="min-w-0">{isEditingNextAction ? <input ref={inputRef} value={draftNextAction} onChange={(event) => setDraftNextAction(event.target.value)} onBlur={() => void saveEditing()} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); cancelEditing(); } }} aria-label="当前事项" className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none ring-1 ring-slate-200" /> : <div onDoubleClick={startEditing} title={app ? "双击编辑当前事项" : undefined} className={`flex min-h-10 w-full items-center rounded-lg px-2 transition-colors ${app ? "cursor-text hover:bg-slate-50" : ""}`}><p className="truncate text-sm text-slate-600">{currentItem.text || "—"}</p></div>}</div></form>;
}
function EmptyState() { return <div className="rounded-3xl border border-dashed border-line bg-white p-6 text-center text-sm text-slate-500">当前筛选条件下还没有岗位记录。</div>; }
function options(values: string[]) { return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b)); }
function setParam(params: URLSearchParams, key: string, value: string) { if (value) params.set(key, value); else params.delete(key); }
