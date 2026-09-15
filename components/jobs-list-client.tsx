"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ApplicationStage } from "@prisma/client";
import { updateApplicationStage } from "@/app/actions";
import { Badge } from "@/components/cards";
import { DeleteJobForm } from "@/components/delete-job-form";
import { getStageDisplayLabel, normalizeApplicationStage, stageOptions } from "@/lib/constants";

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
  const [items, setItems] = useState(jobs); const [query, setQuery] = useState(initialQuery); const [status, setStatus] = useState(initialStatus); const [city, setCity] = useState(initialCity); const [source, setSource] = useState(initialSource); const [view, setView] = useState<"table" | "board">(initialView);
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
  const remove = (id: string) => setItems((current) => current.filter((job) => job.id !== id));

  return <div className="space-y-3"><div className="grid gap-2.5 xl:grid-cols-[minmax(220px,1.35fr)_140px_140px_160px_148px]"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索岗位、公司、进度、事件或下一步" className="h-10 w-full rounded-xl border border-line bg-white px-3.5 text-sm outline-none" /><select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-xl border border-line bg-white px-3 text-sm"><option value="ALL">全部进度</option>{stageOptions.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select><select value={city} onChange={(e) => setCity(e.target.value)} className="h-10 rounded-xl border border-line bg-white px-3 text-sm"><option value="ALL">全部 Base</option>{cities.map((x) => <option key={x}>{x}</option>)}</select><select value={source} onChange={(e) => setSource(e.target.value)} className="h-10 rounded-xl border border-line bg-white px-3 text-sm"><option value="ALL">全部来源</option>{sources.map((x) => <option key={x}>{x}</option>)}</select><div className="grid h-10 grid-cols-2 rounded-xl border border-line bg-white p-1 text-sm"><button onClick={() => setView("table")} className={view === "table" ? "rounded-lg bg-ink text-white" : "text-slate-600"}>列表</button><button onClick={() => setView("board")} className={view === "board" ? "rounded-lg bg-ink text-white" : "text-slate-600"}>看板</button></div></div>{filtered.length === 0 ? <EmptyState /> : view === "table" ? <><div ref={tableScrollRef} onScroll={() => syncScroll("table")} className="overflow-x-auto rounded-3xl border border-line bg-white shadow-card"><div className="min-w-[860px]"><div className="grid grid-cols-[44px_minmax(220px,1.1fr)_115px_150px_minmax(260px,1fr)] border-b border-line bg-slate-50 px-4 py-2 text-[11px] font-medium uppercase tracking-[.14em] text-slate-400"><div>#</div><div>岗位</div><div>Base</div><div>进度</div><div>当前事项</div></div>{filtered.map((job, index) => <JobRow key={job.id} job={job} index={index + 1} onSave={save} />)}</div></div>{hasHorizontalOverflow ? <div ref={secondaryScrollRef} onScroll={() => syncScroll("secondary")} style={{ left: tableMetrics.left, width: tableMetrics.viewportWidth }} className="fixed bottom-0 z-30 hidden overflow-x-auto border-t border-line bg-white/95 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] md:block"><div style={{ width: tableMetrics.scrollWidth }} className="h-4" /></div> : null}</> : <div className="grid gap-3 xl:grid-cols-4 2xl:grid-cols-5">{stageOptions.map((stage) => <section key={stage.value} className="min-h-[220px] rounded-3xl border border-line bg-white p-3 shadow-card"><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold text-ink">{stage.label}</h2><Badge>{filtered.filter((job) => normalizeApplicationStage(job.application?.currentStage || job.status) === stage.value).length}</Badge></div><div className="space-y-3">{filtered.filter((job) => normalizeApplicationStage(job.application?.currentStage || job.status) === stage.value).map((job) => <JobCard key={job.id} job={job} onSave={save} onDeleted={remove} />)}</div></section>)}</div>}</div>;
}

function JobRow({ job, index, onSave }: { job: JobItem; index: number; onSave: (e: FormEvent<HTMLFormElement>) => Promise<void> }) { return <JobEditor job={job} index={index} onSave={onSave} className="grid min-h-[64px] grid-cols-[44px_minmax(220px,1.1fr)_115px_150px_minmax(260px,1fr)] items-center gap-0 border-b border-line px-4 py-2 text-sm" />; }
function JobCard({ job, onSave, onDeleted }: { job: JobItem; onSave: (e: FormEvent<HTMLFormElement>) => Promise<void>; onDeleted: (id: string) => void }) { return <JobEditor job={job} onSave={onSave} onDeleted={onDeleted} className="rounded-2xl border border-line bg-panel p-3 text-sm" card />; }
function JobEditor({ job, index, onSave, onDeleted, className, card = false }: { job: JobItem; index?: number; onSave: (e: FormEvent<HTMLFormElement>) => Promise<void>; onDeleted?: (id: string) => void; className: string; card?: boolean }) {
  const ref = useRef<HTMLFormElement>(null); const app = job.application;
  const controlClass = "h-10 w-full rounded-xl border border-line bg-white px-3 text-sm";
  const fields = <><div className={card ? "mt-2" : ""}><label className="sr-only">进度</label>{app ? <select name="stage" defaultValue={normalizeApplicationStage(app.currentStage)} onChange={() => ref.current?.requestSubmit()} className={controlClass}>{stageOptions.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select> : <span className="text-slate-500">{getStageDisplayLabel(job.status)}</span>}</div>{app ? <><div className={card ? "mt-2" : ""}><input name="nextAction" defaultValue={app.nextAction || ""} onBlur={() => ref.current?.requestSubmit()} placeholder="下一步" className={controlClass} /></div><div className={card ? "mt-2" : ""}><textarea name="note" defaultValue={app.note || ""} onBlur={() => ref.current?.requestSubmit()} placeholder="事件、联系人或个人判断" rows={card ? 2 : 1} className={card ? "w-full resize-none rounded-xl border border-line bg-white px-3 py-2 text-sm" : "h-10 w-full resize-none rounded-xl border border-line bg-white px-3 py-2 text-sm leading-5"} />{card ? <input name="submissionChannel" defaultValue={app.submissionChannel || ""} onBlur={() => ref.current?.requestSubmit()} placeholder="投递渠道" className="mt-2 h-8 w-full rounded-xl border border-line bg-white px-3 text-sm" /> : null}</div></> : <><div className={card ? "mt-2" : ""}>尚未开始</div><div className={card ? "mt-2" : ""}>-</div></>}</>;
  if (card) return <form ref={ref} onSubmit={onSave} className={className}>{app ? <input type="hidden" name="applicationId" value={app.id} /> : null}<Link href={`/jobs/${job.id}`} className="font-semibold text-ink underline-offset-4 hover:underline">{job.roleTitle}</Link><p className="mt-1 text-slate-500">{job.companyName} · {job.city || "地点待确认"}</p>{fields}<div className="mt-3 flex gap-2"><Link href="/tailor" className="text-xs font-medium text-accent">Agent 准备</Link><DeleteJobForm jobLeadId={job.id} onDeleted={onDeleted} /></div></form>;
  const currentItem = getCurrentItem(app);
  return <form ref={ref} onSubmit={onSave} className={className}>{app ? <input type="hidden" name="applicationId" value={app.id} /> : null}<div className="tabular-nums text-xs text-slate-400">{index}</div><div className="min-w-0"><Link href={`/jobs/${job.id}`} className="block truncate font-semibold text-ink underline-offset-4 hover:underline">{job.roleTitle}</Link><div className="mt-1 truncate text-slate-500">{job.companyName}{job.needsReview ? <Badge>待确认</Badge> : null}</div></div><div className="truncate text-slate-600">{job.city || "待确认"}</div><div>{app ? <select name="stage" defaultValue={normalizeApplicationStage(app.currentStage)} onChange={() => ref.current?.requestSubmit()} className={controlClass}>{stageOptions.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select> : <span className="text-slate-500">{getStageDisplayLabel(job.status)}</span>}</div><div className="min-w-0">{currentItem.source === "nextAction" ? <input name="nextAction" defaultValue={currentItem.text} onBlur={() => ref.current?.requestSubmit()} aria-label="当前事项" className={controlClass} /> : <p className="line-clamp-2 text-sm leading-5 text-slate-600">{currentItem.text}</p>}</div></form>;
}
function getCurrentItem(application: JobItem["application"]): { source: "nextAction" | "event" | "empty"; text: string } {
  const nextAction = application?.nextAction?.trim();
  if (nextAction) return { source: "nextAction", text: nextAction };
  const events = application?.events ?? [];
  const event = events.find((item) => item.eventType !== "NOTE") ?? events[0];
  if (event?.title.trim()) return { source: "event", text: event.title.trim() };
  return { source: "empty", text: "—" };
}
function EmptyState() { return <div className="rounded-3xl border border-dashed border-line bg-white p-6 text-center text-sm text-slate-500">当前筛选条件下还没有岗位记录。</div>; }
function options(values: string[]) { return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b)); }
function setParam(params: URLSearchParams, key: string, value: string) { if (value) params.set(key, value); else params.delete(key); }
