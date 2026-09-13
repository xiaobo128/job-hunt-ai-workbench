import { createTailorAdvice, triggerExternalTailor } from "@/app/actions";
import { PageShell } from "@/components/app-shell";
import { Panel, Badge } from "@/components/cards";
import { CopyTextButton } from "@/components/copy-text-button";
import { DeleteTailorRunForm } from "@/components/delete-tailor-run-form";
import { ResumeAnalysisView } from "@/components/resume-analysis-view";
import { TailorStartForm } from "@/components/tailor-start-form";
import { prisma } from "@/lib/db";
import { ResumeAnalysisEnvelopeSchema, type ResumeAnalysis } from "@/lib/resume-analysis";
import { ResumeDocumentSchema, type ResumeDocument } from "@/lib/resume-parsing/core";
import { requireSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

type LegacyPayload = {
  draftTitle?: string; draftText?: string;
  alignment?: { strengths?: string[]; gaps?: string[]; priorities?: string[] };
  jdAnalysis?: { coreResponsibilities?: string[]; mustHaves?: string[]; bonusSignals?: string[]; hiddenPreferences?: string[]; atsKeywords?: string[]; businessContext?: string };
  resumeAnalysis?: { preservedSections?: string[]; evidenceUnits?: string[]; strongEvidence?: string[]; weakEvidence?: string[] };
  validation?: { unsupportedClaims?: string[]; overfitRisks?: string[]; toneRisks?: string[]; followUps?: string[] };
};
type ParsedRun = { kind: "analysis"; analysis: ResumeAnalysis; sourceResumeParseId: string } | { kind: "legacy"; payload: LegacyPayload } | { kind: "draft"; text: string } | { kind: "broken" };

export default async function TailorPage({ searchParams }: { searchParams?: Promise<{ tailorError?: string; jobLeadId?: string; resumeId?: string }> }) {
  const user = await requireSessionUser();
  const params = searchParams ? await searchParams : undefined;
  const [jobs, resumes, runs] = await Promise.all([
    prisma.jobLead.findMany({ where: { ownerId: user.id }, orderBy: { updatedAt: "desc" }, select: { id: true, companyName: true, roleTitle: true } }),
    prisma.resume.findMany({ where: { ownerId: user.id }, orderBy: { updatedAt: "desc" }, take: 20, include: { assets: { select: { kind: true } }, parseAttempts: { where: { status: "CONFIRMED" }, select: { schemaVersion: true, documentJson: true, resumeAsset: { select: { resumeId: true } } } } } }),
    prisma.resumeTailorRun.findMany({ where: { jobLead: { ownerId: user.id } }, orderBy: { createdAt: "desc" }, take: 12, include: { jobLead: { select: { companyName: true, roleTitle: true } }, resume: { select: { title: true } } } })
  ]);
  const parsedRuns = runs.map((run) => parseRun(run.suggestionsJson, run.draftText));
  const sourceParseIds = [...new Set(parsedRuns.flatMap((run) => run.kind === "analysis" ? [run.sourceResumeParseId] : []))];
  const sourceParses = sourceParseIds.length ? await prisma.resumeParse.findMany({ where: { id: { in: sourceParseIds }, resume: { ownerId: user.id }, status: { in: ["CONFIRMED", "SUPERSEDED"] } }, select: { id: true, documentJson: true } }) : [];
  const documents = new Map(sourceParses.flatMap((parse) => { const result = ResumeDocumentSchema.safeParse(parse.documentJson); return result.success ? [[parse.id, result.data] as const] : []; }));

  return <PageShell title="简历微调" description="基于已确认简历生成岗位匹配分析；手动修改后的文件请上传到简历仓库。"><div className="space-y-3">
    <Panel title="发起一次微调" subtitle="选择岗位、已确认简历和个性化要求，生成匹配分析或交给外部 Agent。">
      <TailorStartForm jobs={jobs.map((job) => ({ id: job.id, label: `${job.companyName} | ${job.roleTitle}` }))} resumes={resumes.filter((resume) => resume.parseAttempts.some((parse) => parse.schemaVersion === 1 && parse.resumeAsset.resumeId === resume.id && ResumeDocumentSchema.safeParse(parse.documentJson).success)).map((resume) => ({ id: resume.id, label: `${resume.title}${resume.assets.length ? `（${resume.assets.map((asset) => asset.kind).join(" / ")}）` : ""}` }))} createTailorAdvice={createTailorAdvice} triggerExternalTailor={triggerExternalTailor} initialJobLeadId={params?.jobLeadId} initialResumeId={params?.resumeId} error={params?.tailorError} />
    </Panel>
    <Panel title="最近结果" subtitle="新结果显示固定七维分析；历史记录会以兼容方式只读展示。"><div className="space-y-3">{runs.map((run, index) => <TailorRunCard key={run.id} run={run} parsed={parsedRuns[index]} document={parsedRuns[index].kind === "analysis" ? documents.get(parsedRuns[index].sourceResumeParseId) : undefined} />)}</div></Panel>
    <a href="/resumes" className="inline-flex h-10 items-center justify-center rounded-xl border border-line bg-white px-4 text-sm font-medium text-ink">到简历仓库上传手动修改版</a>
  </div></PageShell>;
}

function TailorRunCard({ run, parsed, document }: { run: { id: string; aiNote: string | null; jobLead: { companyName: string; roleTitle: string }; resume: { title: string } }; parsed: ParsedRun; document?: ResumeDocument }) {
  const label = parsed.kind === "analysis" ? "七维匹配分析" : parsed.kind === "draft" ? "历史草稿" : parsed.kind === "legacy" ? "历史分析" : "记录不可用";
  return <div className="rounded-3xl border border-line p-4"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><div className="text-lg font-semibold text-ink">{run.jobLead.companyName} | {run.jobLead.roleTitle}</div><div className="mt-2 flex flex-wrap gap-2"><Badge>{label}</Badge><span className="text-sm text-slate-500">基于 {run.resume.title}</span></div></div><DeleteTailorRunForm tailorRunId={run.id} /></div>{run.aiNote ? <p className="mt-2 text-xs leading-5 text-slate-500">{run.aiNote}</p> : null}{parsed.kind === "analysis" ? <ResumeAnalysisView analysis={parsed.analysis} evidence={resolveEvidence(parsed.analysis, document)} /> : null}{parsed.kind === "legacy" ? <LegacyAnalysis payload={parsed.payload} /> : null}{parsed.kind === "draft" ? <DraftParagraphs text={parsed.text} /> : null}{parsed.kind === "broken" ? <div className="mt-3 rounded-2xl bg-panel px-4 py-3 text-sm text-slate-600">该条历史结果暂无法识别或已损坏。</div> : null}</div>;
}

function resolveEvidence(analysis: ResumeAnalysis, document?: ResumeDocument): Record<keyof ResumeAnalysis, string[]> {
  const unavailable = "该条历史证据暂不可用";
  return Object.fromEntries((Object.keys(analysis) as Array<keyof ResumeAnalysis>).map((key) => [key, analysis[key].evidenceRefs.map((ref) => evidenceText(document, ref) || unavailable)])) as Record<keyof ResumeAnalysis, string[]>;
}
function evidenceText(document: ResumeDocument | undefined, ref: ResumeAnalysis[keyof ResumeAnalysis]["evidenceRefs"][number]) {
  const section = document?.sections.find((candidate) => candidate.id === ref.sectionId); if (!section) return null;
  if (!ref.itemId) return ref.bulletId ? null : section.title;
  const item = section.items.find((candidate) => candidate.id === ref.itemId); if (!item) return null;
  const detail = [item.heading, item.subheading, [item.startDate, item.endDate].filter(Boolean).join(" - ")].filter(Boolean).join("｜");
  if (!ref.bulletId) return `${section.title}｜${detail}`;
  const bullet = item.bullets.find((candidate) => candidate.id === ref.bulletId); return bullet ? `${section.title}｜${detail}：${bullet.text}` : null;
}

function parseRun(json: string, draftText: string | null): ParsedRun {
  let value: unknown; try { value = JSON.parse(json); } catch { return draftText?.trim() ? { kind: "draft", text: draftText } : { kind: "broken" }; }
  const envelope = ResumeAnalysisEnvelopeSchema.safeParse(value); if (envelope.success) return { kind: "analysis", analysis: envelope.data.dimensions, sourceResumeParseId: envelope.data.sourceResumeParseId };
  const record = isRecord(value); const text = draftText?.trim() || stringValue(record?.draftText); if (text) return { kind: "draft", text };
  return hasLegacyAnalysis(record) ? { kind: "legacy", payload: record as LegacyPayload } : { kind: "broken" };
}
function LegacyAnalysis({ payload }: { payload: LegacyPayload }) {
  const groups: Array<[string, string[]]> = [["优势项", stringArray(payload.alignment?.strengths)], ["差距项", stringArray(payload.alignment?.gaps)], ["优先调整点", stringArray(payload.alignment?.priorities)], ["核心职责", stringArray(payload.jdAnalysis?.coreResponsibilities)], ["必备能力", stringArray(payload.jdAnalysis?.mustHaves)], ["强证据", stringArray(payload.resumeAnalysis?.strongEvidence)], ["待补强", stringArray(payload.resumeAnalysis?.weakEvidence)], ["风险提示", stringArray(payload.validation?.unsupportedClaims)]];
  return <div className="mt-3 space-y-3">{groups.filter(([, items]) => items.length).map(([title, items]) => <div key={title} className="rounded-2xl bg-panel p-4"><div className="text-xs font-medium text-slate-500">{title}</div>{items.map((item, index) => <div key={index} className="mt-1 text-sm leading-6 text-slate-700">{item}</div>)}</div>)}</div>;
}
function DraftParagraphs({ text }: { text: string }) { const paragraphs = text.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean); return <div className="mt-3 space-y-3">{paragraphs.map((paragraph, index) => <div key={index} className="rounded-2xl bg-panel p-4"><div className="flex justify-end"><CopyTextButton text={paragraph} /></div><p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{paragraph}</p></div>)}</div>; }
function isRecord(value: unknown): Record<string, unknown> | null { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function stringValue(value: unknown) { return typeof value === "string" ? value : ""; }
function stringArray(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function hasLegacyAnalysis(value: Record<string, unknown> | null) { return Boolean(value && ["alignment", "jdAnalysis", "resumeAnalysis", "validation"].some((key) => isRecord(value[key]))); }
