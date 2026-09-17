"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type DragEvent, type KeyboardEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ApplicationStage } from "@prisma/client";
import { updateApplicationStage, updateJobsTableField } from "@/app/actions";
import { Badge } from "@/components/cards";
import { normalizeApplicationStage, stageOptions } from "@/lib/constants";

type JobItem = {
  id: string; companyName: string; roleTitle: string; city: string | null; seniority: string | null;
  sourceName: string | null; sourceUrl: string | null; parsedSummary: string | null; rawContent: string; needsReview: boolean;
  skills: string; status: ApplicationStage; updatedAt: Date;
  application: { id: string; currentStage: ApplicationStage; submissionChannel: string | null; nextAction: string | null; note: string | null; appliedAt: Date | null; updatedAt: Date; events: Array<{ eventType: string; title: string; eventTime: Date | null; createdAt: Date }> } | null;
};

export function JobsListClient({ jobs, initialView = "table", initialQuery = "", initialStatus = "ALL", initialCity = "ALL", initialSource = "ALL" }: {
  jobs: JobItem[]; initialView?: "table" | "board"; initialQuery?: string; initialStatus?: string; initialCity?: string; initialSource?: string;
}) {
  const router = useRouter(); const pathname = usePathname(); const searchParams = useSearchParams();
  const [items, setItems] = useState(jobs); const [query, setQuery] = useState(initialQuery); const [status, setStatus] = useState(initialStatus); const [city, setCity] = useState(initialCity); const [source, setSource] = useState(initialSource); const [view, setView] = useState<"table" | "board">(initialView); const [draggedJobId, setDraggedJobId] = useState<string | null>(null); const [dropStage, setDropStage] = useState<ApplicationStage | null>(null); const [moveError, setMoveError] = useState<string | null>(null);
  const cities = useMemo(() => options(items.map((job) => job.city || "地点待确认")), [items]);
  const sources = useMemo(() => options(items.map((job) => job.sourceName || "主动导入")), [items]);
  const filtered = useMemo(() => items.filter((job) => {
    const stage = normalizeApplicationStage(job.application?.currentStage || job.status);
    const haystack = [job.companyName, job.roleTitle, job.city, job.sourceName, job.application?.submissionChannel, job.application?.nextAction, job.application?.note, job.parsedSummary, job.skills].join(" ").toLowerCase();
    return (!query.trim() || haystack.includes(query.trim().toLowerCase())) && (status === "ALL" || stage === status) && (city === "ALL" || (job.city || "地点待确认") === city) && (source === "ALL" || (job.sourceName || "主动导入") === source);
  }), [items, query, status, city, source]);

  useEffect(() => { const params = new URLSearchParams(searchParams.toString()); setParam(params, "view", view === "board" ? "board" : ""); setParam(params, "q", query.trim()); setParam(params, "status", status === "ALL" ? "" : status); setParam(params, "city", city === "ALL" ? "" : city); setParam(params, "source", source === "ALL" ? "" : source); const next = params.toString(); if (next !== searchParams.toString()) router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false }); }, [city, pathname, query, router, searchParams, source, status, view]);

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

  return <div className="min-w-0 space-y-3"><div className="grid gap-2.5 xl:grid-cols-[minmax(220px,1.35fr)_140px_140px_160px_148px]"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索岗位、公司、进度、事件或下一步" className="h-10 w-full rounded-xl border border-line bg-white px-3.5 text-sm outline-none" /><select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-xl border border-line bg-white px-3 text-sm"><option value="ALL">全部进度</option>{stageOptions.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select><select value={city} onChange={(e) => setCity(e.target.value)} className="h-10 rounded-xl border border-line bg-white px-3 text-sm"><option value="ALL">全部 Base</option>{cities.map((x) => <option key={x}>{x}</option>)}</select><select value={source} onChange={(e) => setSource(e.target.value)} className="h-10 rounded-xl border border-line bg-white px-3 text-sm"><option value="ALL">全部来源</option>{sources.map((x) => <option key={x}>{x}</option>)}</select><div className="grid h-10 grid-cols-2 rounded-xl border border-line bg-white p-1 text-sm"><button onClick={() => setView("table")} className={view === "table" ? "rounded-lg bg-ink text-white" : "text-slate-600"}>列表</button><button onClick={() => setView("board")} className={view === "board" ? "rounded-lg bg-ink text-white" : "text-slate-600"}>看板</button></div></div>{moveError ? <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{moveError}</p> : null}{filtered.length === 0 ? <EmptyState /> : view === "table" ? <div className="max-h-[calc(100dvh-220px)] overflow-x-auto overflow-y-auto rounded-3xl border border-line bg-white shadow-card"><table className="min-w-[1370px] border-separate border-spacing-0 text-left text-sm"><thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-medium uppercase tracking-[.12em] text-slate-400"><tr>{["公司名称", "岗位名称", "Base", "行业", "投递日期", "进度", "所用简历", "投递链接", "来源"].map((label) => <th key={label} className="whitespace-nowrap border-b border-line px-3 py-2.5 font-medium">{label}</th>)}<th className="sticky right-0 z-20 w-[250px] border-b border-l border-line bg-slate-50 px-3 py-2.5 font-medium shadow-[-3px_0_8px_rgba(15,23,42,0.04)]">备注</th></tr></thead><tbody>{filtered.map((job) => <ApplicationTrackerRow key={job.id} job={job} onUpdate={setItems} onError={setMoveError} onStageChange={moveCard} />)}</tbody></table></div> : <div className="grid gap-3 xl:grid-cols-4 2xl:grid-cols-5">{stageOptions.map((stage) => { const stageJobs = filtered.filter((job) => normalizeApplicationStage(job.application?.currentStage || job.status) === stage.value); const isDropTarget = dropStage === stage.value; return <section key={stage.value} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropStage(stage.value); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropStage((current) => current === stage.value ? null : current); }} onDrop={(event) => handleDrop(event, stage.value)} className={`rounded-3xl border p-3 shadow-card transition-colors ${isDropTarget ? "border-accent bg-accent/5" : "border-line bg-white"}`}><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold text-ink">{stage.label}</h2><Badge>{stageJobs.length}</Badge></div><div className={`space-y-2 overflow-y-auto pr-1 ${stageJobs.length > 3 ? "max-h-[196px]" : ""}`}>{stageJobs.map((job) => <JobCard key={job.id} job={job} isDragging={draggedJobId === job.id} onDragStart={handleDragStart} onDragEnd={() => { setDraggedJobId(null); setDropStage(null); }} />)}</div></section>; })}</div>}</div>;
}

type EditableField = "companyName" | "roleTitle" | "city" | "sourceUrl" | "sourceName" | "appliedAt" | "note";

function ApplicationTrackerRow({ job, onUpdate, onError, onStageChange }: { job: JobItem; onUpdate: React.Dispatch<React.SetStateAction<JobItem[]>>; onError: (message: string | null) => void; onStageChange: (jobId: string, stage: ApplicationStage) => Promise<void> }) {
  const stage = normalizeApplicationStage(job.application?.currentStage || job.status);
  const appliedAt = job.application?.appliedAt;
  const save = async (field: EditableField, value: string) => {
    const previous = job;
    onError(null);
    onUpdate((items) => items.map((item) => {
      if (item.id !== job.id) return item;
      if (field === "appliedAt" || field === "note") return item.application ? { ...item, application: { ...item.application, [field]: field === "appliedAt" ? (value ? new Date(`${value}T00:00:00`) : null) : (value || null) } } : item;
      return { ...item, [field]: value || null };
    }));
    try {
      await updateJobsTableField({ jobLeadId: job.id, field, value });
    } catch (error) {
      onUpdate((items) => items.map((item) => item.id === job.id ? previous : item));
      onError(error instanceof Error ? error.message : "保存失败，请重试。");
      throw error;
    }
  };

  return <tr className="group hover:bg-slate-50/70"><InlineEditableCell className="w-[160px] font-medium text-ink" value={job.companyName} field="companyName" onSave={save} /><TrackerCell className="w-[230px]"><div className="flex min-w-0 items-center gap-1"><Link href={`/jobs/${job.id}`} className="min-w-0 flex-1 truncate font-medium text-ink underline-offset-4 hover:text-accent hover:underline" title={job.roleTitle}>{job.roleTitle}</Link><InlineEditableCell className="w-5 shrink-0 px-0 py-0" value={job.roleTitle} field="roleTitle" onSave={save} iconOnly /></div></TrackerCell><InlineEditableCell className="w-[130px]" value={job.city || ""} field="city" onSave={save} /><TrackerCell className="w-[100px]">—</TrackerCell><InlineEditableCell className="w-[108px]" value={appliedAt ? dateInputValue(appliedAt) : ""} field="appliedAt" onSave={save} inputType="date" displayValue={appliedAt ? monthDay(appliedAt) : "—"} /><TrackerCell className="w-[120px]"><StageMenu stage={stage} disabled={!job.application} onChange={(nextStage) => onStageChange(job.id, nextStage)} /></TrackerCell><TrackerCell className="w-[130px]">—</TrackerCell><InlineEditableCell className="w-[92px]" value={job.sourceUrl || ""} field="sourceUrl" onSave={save} linkValue={job.sourceUrl} /><InlineEditableCell className="w-[130px]" value={job.sourceName || ""} field="sourceName" onSave={save} /><InlineEditableCell className="sticky right-0 z-[1] w-[250px] border-l bg-white shadow-[-3px_0_8px_rgba(15,23,42,0.04)] group-hover:bg-slate-50/70" value={job.application?.note || ""} field="note" onSave={save} textarea /></tr>;
}

function InlineEditableCell({ value, field, onSave, className = "", displayValue, inputType = "text", textarea = false, linkValue, iconOnly = false }: { value: string; field: EditableField; onSave: (field: EditableField, value: string) => Promise<void>; className?: string; displayValue?: string; inputType?: "text" | "date"; textarea?: boolean; linkValue?: string | null; iconOnly?: boolean }) {
  const [editing, setEditing] = useState(false); const [draft, setDraft] = useState(value); const [saving, setSaving] = useState(false);
  useEffect(() => { if (!editing) setDraft(value); }, [editing, value]);
  const cancel = () => { setDraft(value); setEditing(false); };
  const commit = async () => { if (saving) return; if (draft === value) { setEditing(false); return; } setSaving(true); try { await onSave(field, draft); setEditing(false); } catch { cancel(); } finally { setSaving(false); } };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => { if (event.key === "Escape") { event.preventDefault(); cancel(); } else if ((!textarea && event.key === "Enter") || (textarea && event.key === "Enter" && (event.metaKey || event.ctrlKey))) { event.preventDefault(); void commit(); } };
  if (iconOnly) return <button type="button" onClick={() => setEditing(true)} aria-label="编辑岗位名称" className="text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-accent">✎</button>;
  return <td className={`max-w-0 whitespace-nowrap border-b border-line px-3 py-2 text-slate-600 ${className}`} onDoubleClick={() => !editing && setEditing(true)} title={!editing ? displayValue || value || undefined : undefined}>{editing ? textarea ? <textarea autoFocus rows={2} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} onBlur={() => void commit()} className="block h-12 w-full resize-none rounded-lg border border-accent bg-white px-2 py-1 text-sm text-ink outline-none" /> : <input autoFocus type={inputType} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} onBlur={() => void commit()} className="h-7 w-full rounded-lg border border-accent bg-white px-2 text-sm text-ink outline-none" /> : <div className="truncate">{saving ? "保存中…" : linkValue ? <><a href={linkValue} target="_blank" rel="noreferrer" onDoubleClick={(event) => event.preventDefault()} className="font-medium text-accent underline-offset-4 hover:underline">打开</a><span className="sr-only">，双击单元格编辑链接</span></> : displayValue || value || "—"}</div>}</td>;
}

function StageMenu({ stage, disabled, onChange }: { stage: ApplicationStage; disabled: boolean; onChange: (stage: ApplicationStage) => Promise<void> }) {
  const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false);
  const label = stageOptions.find((option) => option.value === stage)?.label || "—";
  return <div className="relative"><button type="button" disabled={disabled || saving} onClick={() => setOpen((current) => !current)} className="rounded-full text-left disabled:cursor-not-allowed"><Badge>{saving ? "保存中…" : label}</Badge></button>{open ? <div className="absolute left-0 top-full z-30 mt-1 w-32 rounded-xl border border-line bg-white p-1 shadow-card">{stageOptions.map((option) => <button key={option.value} type="button" onClick={() => { setSaving(true); void onChange(option.value).finally(() => { setSaving(false); setOpen(false); }); }} className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-panel ${option.value === stage ? "font-semibold text-accent" : "text-slate-700"}`}>{option.label}</button>)}</div> : null}</div>;
}
function TrackerCell({ children, className = "", title }: { children: React.ReactNode; className?: string; title?: string }) { return <td title={title} className={`max-w-0 whitespace-nowrap border-b border-line px-3 py-2 text-slate-600 ${className}`}><div className="truncate">{children}</div></td>; }
function JobCard({ job, isDragging, onDragStart, onDragEnd }: { job: JobItem; isDragging: boolean; onDragStart: (event: DragEvent<HTMLAnchorElement>, jobId: string) => void; onDragEnd: () => void }) { return <Link href={`/jobs/${job.id}`} draggable={Boolean(job.application)} onDragStart={(event) => onDragStart(event, job.id)} onDragEnd={onDragEnd} className={`block cursor-grab rounded-2xl border border-line bg-panel px-3 py-2.5 text-sm transition hover:border-slate-300 hover:shadow-sm active:cursor-grabbing ${isDragging ? "opacity-50" : ""}`}><div className="truncate font-semibold text-ink">{job.roleTitle}</div><div className="mt-1 truncate text-xs text-slate-500">{job.companyName}{job.city ? ` · ${job.city}` : ""}</div></Link>; }
function EmptyState() { return <div className="rounded-3xl border border-dashed border-line bg-white p-6 text-center text-sm text-slate-500">当前筛选条件下还没有岗位记录。</div>; }
function options(values: string[]) { return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b)); }
function setParam(params: URLSearchParams, key: string, value: string) { if (value) params.set(key, value); else params.delete(key); }
function monthDay(date: Date) { return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(date); }
function fullDate(date: Date) { return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date); }
function dateInputValue(date: Date) { const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, "0"); const day = String(date.getDate()).padStart(2, "0"); return `${year}-${month}-${day}`; }
