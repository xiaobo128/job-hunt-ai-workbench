import { PageShell } from "@/components/app-shell";
import { Panel, Badge } from "@/components/cards";
import {
  createTailorAdvice,
  createTailorDraft,
  reviseTailorDraftRun,
  saveDraftAsResume,
  triggerExternalTailor
} from "@/app/actions";
import { AutoDownloadVariant } from "@/components/auto-download-variant";
import { DeleteTailorRunForm } from "@/components/delete-tailor-run-form";
import { TailorPendingButton, TailorPendingNotice } from "@/components/tailor-pending";
import { TailorStartForm } from "@/components/tailor-start-form";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { chooseResumeAssetSources, resolveResumeText } from "@/lib/resume-assets";
import { requireSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

type TailorParsedPayload = {
  draftTitle?: string;
  draftText?: string;
  jdAnalysis?: {
    coreResponsibilities?: string[];
    mustHaves?: string[];
    bonusSignals?: string[];
    hiddenPreferences?: string[];
    atsKeywords?: string[];
    businessContext?: string;
  };
  resumeAnalysis?: {
    preservedSections?: string[];
    evidenceUnits?: string[];
    strongEvidence?: string[];
    weakEvidence?: string[];
  };
  alignment?: {
    strengths?: string[];
    gaps?: string[];
    priorities?: string[];
  };
  validation?: {
    unsupportedClaims?: string[];
    overfitRisks?: string[];
    toneRisks?: string[];
    followUps?: string[];
  };
};

export default async function TailorPage({
  searchParams
}: {
  searchParams?: Promise<{
    downloadVariantId?: string;
    run?: string;
    rev?: string;
    ts?: string;
    mode?: string;
    jobLeadId?: string;
    resumeId?: string;
  }>;
}) {
  const user = await requireSessionUser();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const refreshKey = [
    resolvedSearchParams?.downloadVariantId || "",
    resolvedSearchParams?.run || "",
    resolvedSearchParams?.rev || "",
    resolvedSearchParams?.ts || "",
    resolvedSearchParams?.mode || ""
  ].join(":");

  const [jobs, resumes, runs, savedVariants] = await Promise.all([
    prisma.jobLead.findMany({
      where: { ownerId: user.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true, companyName: true, roleTitle: true }
    }),
    prisma.resume.findMany({
      where: { ownerId: user.id },
      include: {
        assets: {
          select: { kind: true }
        }
      },
      orderBy: { updatedAt: "desc" },
      take: 20
    }),
    prisma.resumeTailorRun.findMany({
      where: { jobLead: { ownerId: user.id } },
      include: {
        jobLead: { select: { companyName: true, roleTitle: true } },
        resume: {
          select: {
            title: true,
            rawText: true,
            note: true,
            assets: {
              select: {
                id: true,
                extractedText: true,
                fileUrl: true,
                artifactName: true,
                artifactMimeType: true,
                isEditingSource: true,
                isPreviewSource: true,
                kind: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 12
    }),
    prisma.resumeVariant.findMany({
      where: { resume: { ownerId: user.id }, sourceType: "AI_DRAFT" },
      include: {
        jobLead: { select: { companyName: true, roleTitle: true } },
        resume: { select: { title: true } }
      },
      orderBy: { updatedAt: "desc" },
      take: 8
    })
  ]);

  return (
    <PageShell
      title="简历微调"
      description="这里可以先生成微调建议，也可以直接生成完整草稿，并导出为 DOCX 或 PDF。"
    >
      <div key={refreshKey} className="space-y-3">
        <AutoDownloadVariant variantId={resolvedSearchParams?.downloadVariantId} />

        <Panel title="发起一次微调" subtitle="选择岗位和简历，然后决定是先看建议，还是直接生成一版新的草稿。">
          <TailorStartForm
            jobs={jobs.map((job) => ({
              id: job.id,
              label: `${job.companyName} | ${job.roleTitle}`
            }))}
            resumes={resumes.map((resume) => ({
              id: resume.id,
              label: `${resume.title}${resume.assets.length > 0 ? `（${resume.assets.map((asset) => asset.kind).join(" / ")}）` : ""}`
            }))}
            createTailorAdvice={createTailorAdvice}
            createTailorDraft={createTailorDraft}
            triggerExternalTailor={triggerExternalTailor}
            initialJobLeadId={resolvedSearchParams?.jobLeadId}
            initialResumeId={resolvedSearchParams?.resumeId}
          />
        </Panel>

        <Panel title="最近结果" subtitle="微调建议里会显示匹配分析、JD 解析、简历素材拆解和风险校验；完整草稿用于导出归档。">
          <div className="space-y-3">
            {runs.map((run) => {
              const parsed = safeParseTailorPayload(run.suggestionsJson);
              const staleMissingTextRun = isStaleMissingTextRun(run.aiNote, run.summary, resolveResumeText(run.resume).text);
              const resultType = getTailorRunType({
                staleMissingTextRun,
                draftText: run.draftText || parsed.draftText || ""
              });
              const isDraftRun = Boolean((run.draftText || parsed.draftText || "").trim());

              return (
                <div key={run.id} className="rounded-3xl border border-line p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="text-lg font-semibold text-ink">
                        {run.jobLead.companyName} | {run.jobLead.roleTitle}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge>{resultType}</Badge>
                        <span className="text-sm text-slate-500">基于 {run.resume.title}</span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      <DeleteTailorRunForm tailorRunId={run.id} />
                    </div>
                  </div>

                  {run.aiNote ? <p className="mt-2 text-xs leading-5 text-slate-500">{run.aiNote}</p> : null}
                  {isDraftRun || staleMissingTextRun ? (
                    <p className="mt-3 text-sm leading-6 text-slate-700">{run.summary}</p>
                  ) : null}

                  {staleMissingTextRun ? (
                    <form className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <input type="hidden" name="jobLeadId" value={run.jobLeadId} />
                      <input type="hidden" name="resumeId" value={run.resumeId} />
                      <div className="text-sm font-medium text-emerald-800">这条结果是在正文补齐前生成的旧记录</div>
                      <p className="mt-1 text-xs leading-5 text-emerald-700">
                        当前这份简历已经提取到正文了，你可以直接重新生成建议或草稿，不用先删除旧记录。
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <TailorPendingButton
                          formAction={createTailorAdvice}
                          idleText="重新生成建议"
                          pendingText="正在生成建议..."
                          className="w-full border border-emerald-300 bg-white text-emerald-800"
                        />
                        <TailorPendingButton
                          formAction={createTailorDraft}
                          idleText="重新生成草稿"
                          pendingText="正在生成草稿..."
                          className="w-full bg-emerald-600 text-white"
                        />
                      </div>
                      <TailorPendingNotice text="正在重新请求 AI 生成结果，请稍候..." />
                    </form>
                  ) : null}

                  {isDraftRun ? (
                    <div className="mt-4 rounded-2xl bg-panel p-4">
                      <div className="text-sm font-medium text-ink">完整草稿</div>
                      <div className="mt-3 space-y-3">
                        <DraftSection title="原始版本">
                          <OriginalResumePanel resume={run.resume} />
                        </DraftSection>

                        <DraftSection title="新版本草稿">
                          <form className="space-y-3">
                            <input type="hidden" name="tailorRunId" value={run.id} />
                            <input
                              name="draftTitle"
                              defaultValue={run.draftTitle || parsed.draftTitle || ""}
                              className="h-10 w-full rounded-xl border border-line bg-panel px-3.5 text-sm outline-none"
                              placeholder="给这份定制简历起一个标题"
                            />
                            <textarea
                              name="draftText"
                              defaultValue={run.draftText || parsed.draftText || ""}
                              rows={16}
                              className="w-full rounded-2xl border border-line bg-panel px-3.5 py-3 text-sm leading-6 outline-none"
                              placeholder="这里会显示新生成的简历草稿"
                            />
                            <textarea
                              name="revisionInstructions"
                              rows={4}
                              className="w-full rounded-2xl border border-line bg-panel px-3.5 py-3 text-sm leading-6 outline-none"
                              placeholder="如果还想继续微调这版草稿，在这里写新的要求。例如：把项目经历压缩一点；去掉求职意向；强化 B 端产品和数据分析表达。"
                            />
                            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                              <TailorPendingButton
                                formAction={reviseTailorDraftRun}
                                idleText="按新要求继续修改"
                                pendingText="正在继续修改..."
                                className="w-full border border-line bg-white text-ink"
                              />
                              <TailorPendingButton
                                formAction={saveDraftAsResume}
                                name="exportFormat"
                                value="DOCX"
                                idleText="导出 DOCX 并归档"
                                pendingText="正在导出 DOCX..."
                                className="w-full bg-ink text-white"
                              />
                              <TailorPendingButton
                                formAction={saveDraftAsResume}
                                name="exportFormat"
                                value="PDF"
                                idleText="导出 PDF 并归档"
                                pendingText="正在导出 PDF..."
                                className="w-full bg-accent text-white"
                              />
                              <a
                                href="/resumes"
                                className="inline-flex h-10 w-full items-center justify-center whitespace-nowrap rounded-xl border border-line bg-white px-4 text-sm font-medium text-ink"
                              >
                                去简历仓库查看
                              </a>
                            </div>
                            <TailorPendingNotice text="AI 正在处理或导出文件，这一步完成前请不要重复点击。" />
                            <p className="text-xs leading-5 text-slate-500">
                              会按“原始简历名-公司-岗位”命名，并覆盖这个岗位之前保存的 AI 草稿文件。保存后浏览器会自动开始下载。
                            </p>
                          </form>
                        </DraftSection>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl bg-panel p-4">
                      <div className="text-sm font-medium text-ink">微调建议</div>
                      <WorkflowInsightSections parsed={parsed} />
                    </div>
                  )}

                  {!isDraftRun && !staleMissingTextRun && !hasInsightContent(parsed) ? (
                    <div className="mt-3 rounded-2xl bg-panel px-4 py-3 text-sm text-slate-600">
                      这条结果没有可展示的结构化分析，建议重新生成匹配分析。
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="最近保存文件" subtitle="这里列出最近归档到简历仓库的 AI 草稿文件，方便你直接下载或回仓库查看。">
          {savedVariants.length === 0 ? (
            <div className="rounded-2xl bg-panel px-4 py-3 text-sm text-slate-500">
              还没有保存过 AI 草稿文件。生成完整草稿后点“导出 DOCX 并归档”或“导出 PDF 并归档”，这里就会出现最新记录。
            </div>
          ) : (
            <div className="space-y-3">
              {savedVariants.map((variant) => (
                <div key={variant.id} className="rounded-2xl border border-line p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-sm font-medium text-ink">{getVariantArtifactName(variant.artifactName, variant.title)}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {variant.jobLead ? `${variant.jobLead.companyName} | ${variant.jobLead.roleTitle}` : "未关联岗位"} | 保存于{" "}
                        {formatDate(variant.updatedAt)}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">基于 {variant.resume.title}</div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {variant.fileUrl ? (
                        <a
                          href={`/api/resume-variants/${variant.id}/download`}
                          className="inline-flex h-10 min-w-[136px] items-center justify-center rounded-xl border border-line bg-white px-4 text-sm font-medium text-ink"
                        >
                          下载文件
                        </a>
                      ) : null}
                      <a
                        href="/resumes"
                        className="inline-flex h-10 min-w-[136px] items-center justify-center rounded-xl bg-ink px-4 text-sm font-medium text-white"
                      >
                        去简历仓库
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </PageShell>
  );
}

function hasInsightContent(parsed: TailorParsedPayload) {
  const alignment = parsed.alignment;
  const jdAnalysis = parsed.jdAnalysis;
  const resumeAnalysis = parsed.resumeAnalysis;
  const validation = parsed.validation;

  return Boolean(
    [
      ...(alignment?.strengths || []),
      ...(alignment?.gaps || []),
      ...(alignment?.priorities || []),
      ...(jdAnalysis?.coreResponsibilities || []),
      ...(jdAnalysis?.mustHaves || []),
      ...(jdAnalysis?.bonusSignals || []),
      ...(jdAnalysis?.hiddenPreferences || []),
      ...(jdAnalysis?.atsKeywords || []),
      jdAnalysis?.businessContext || "",
      ...(resumeAnalysis?.preservedSections || []),
      ...(resumeAnalysis?.evidenceUnits || []),
      ...(resumeAnalysis?.strongEvidence || []),
      ...(resumeAnalysis?.weakEvidence || []),
      ...(validation?.unsupportedClaims || []),
      ...(validation?.overfitRisks || []),
      ...(validation?.toneRisks || []),
      ...(validation?.followUps || [])
    ].some(Boolean)
  );
}

function safeParseTailorPayload(value: string | null) {
  if (!value?.trim()) {
    return {} as TailorParsedPayload;
  }

  try {
    return JSON.parse(value) as TailorParsedPayload;
  } catch {
    return {} as TailorParsedPayload;
  }
}

function WorkflowInsightSections({ parsed }: { parsed: TailorParsedPayload }) {
  const alignment = parsed.alignment;
  const jdAnalysis = parsed.jdAnalysis;
  const resumeAnalysis = parsed.resumeAnalysis;
  const validation = parsed.validation;

  const hasAlignment =
    alignment &&
    [...(alignment.strengths || []), ...(alignment.gaps || []), ...(alignment.priorities || [])].some(Boolean);
  const hasJdAnalysis =
    jdAnalysis &&
    [
      ...(jdAnalysis.coreResponsibilities || []),
      ...(jdAnalysis.mustHaves || []),
      ...(jdAnalysis.bonusSignals || []),
      ...(jdAnalysis.hiddenPreferences || []),
      ...(jdAnalysis.atsKeywords || []),
      jdAnalysis.businessContext || ""
    ].some(Boolean);
  const hasResumeAnalysis =
    resumeAnalysis &&
    [
      ...(resumeAnalysis.preservedSections || []),
      ...(resumeAnalysis.evidenceUnits || []),
      ...(resumeAnalysis.strongEvidence || []),
      ...(resumeAnalysis.weakEvidence || [])
    ].some(Boolean);
  const hasValidation =
    validation &&
    [
      ...(validation.unsupportedClaims || []),
      ...(validation.overfitRisks || []),
      ...(validation.toneRisks || []),
      ...(validation.followUps || [])
    ].some(Boolean);

  if (!hasAlignment && !hasJdAnalysis && !hasResumeAnalysis && !hasValidation) {
    return <p className="mt-3 text-sm leading-6 text-slate-700">这次还没有形成可展示的结构化微调建议。</p>;
  }

  return (
    <div className="mt-3 space-y-3">
      {hasAlignment ? (
        <InsightSection title="匹配分析">
          <InsightList title="优势项" items={alignment?.strengths || []} />
          <InsightList title="差距项" items={alignment?.gaps || []} />
          <InsightList title="优先调整点" items={alignment?.priorities || []} />
        </InsightSection>
      ) : null}

      {hasJdAnalysis ? (
        <InsightSection title="JD 解析">
          <InsightList title="核心职责" items={jdAnalysis?.coreResponsibilities || []} />
          <InsightList title="必备能力" items={jdAnalysis?.mustHaves || []} />
          <InsightList title="加分项" items={jdAnalysis?.bonusSignals || []} />
          <InsightList title="隐含偏好" items={jdAnalysis?.hiddenPreferences || []} />
          <InsightList title="ATS 关键词" items={jdAnalysis?.atsKeywords || []} />
          {jdAnalysis?.businessContext ? (
            <div className="rounded-2xl bg-panel px-4 py-3 text-sm leading-6 text-slate-700">
              <div className="text-xs font-medium text-slate-500">业务语境</div>
              <div className="mt-1">{jdAnalysis.businessContext}</div>
            </div>
          ) : null}
        </InsightSection>
      ) : null}

      {hasResumeAnalysis ? (
        <InsightSection title="简历素材拆解">
          <InsightList title="保留分区" items={resumeAnalysis?.preservedSections || []} />
          <InsightList title="可用证据单元" items={resumeAnalysis?.evidenceUnits || []} />
          <InsightList title="强证据" items={resumeAnalysis?.strongEvidence || []} />
          <InsightList title="弱证据 / 待补强" items={resumeAnalysis?.weakEvidence || []} />
        </InsightSection>
      ) : null}

      {hasValidation ? (
        <InsightSection title="风险校验">
          <InsightList title="潜在超范围表述" items={validation?.unsupportedClaims || []} />
          <InsightList title="强行贴 JD 风险" items={validation?.overfitRisks || []} />
          <InsightList title="语气 / AI 腔风险" items={validation?.toneRisks || []} />
          <InsightList title="仍需确认" items={validation?.followUps || []} />
        </InsightSection>
      ) : null}
    </div>
  );
}

function InsightSection({ title, children }: { title: string; children: import("react").ReactNode }) {
  return (
    <details className="rounded-2xl border border-line bg-white px-4 py-3">
      <summary className="cursor-pointer list-none text-sm font-medium text-ink">
        <div className="flex items-center justify-between gap-3">
          <span>{title}</span>
          <span className="text-slate-400">点击展开</span>
        </div>
      </summary>
      <div className="mt-3 space-y-2">{children}</div>
    </details>
  );
}

function DraftSection({ title, children }: { title: string; children: import("react").ReactNode }) {
  return (
    <details className="rounded-2xl border border-line bg-white px-4 py-3">
      <summary className="cursor-pointer list-none text-sm font-medium text-ink">
        <div className="flex items-center justify-between gap-3">
          <span>{title}</span>
          <span className="text-slate-400">点击展开</span>
        </div>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function WorkflowInsightBlocks({ parsed }: { parsed: TailorParsedPayload }) {
  const alignment = parsed.alignment;
  const jdAnalysis = parsed.jdAnalysis;
  const resumeAnalysis = parsed.resumeAnalysis;
  const validation = parsed.validation;

  const hasAlignment =
    alignment &&
    [...(alignment.strengths || []), ...(alignment.gaps || []), ...(alignment.priorities || [])].some(Boolean);
  const hasJdAnalysis =
    jdAnalysis &&
    [
      ...(jdAnalysis.coreResponsibilities || []),
      ...(jdAnalysis.mustHaves || []),
      ...(jdAnalysis.bonusSignals || []),
      ...(jdAnalysis.hiddenPreferences || []),
      ...(jdAnalysis.atsKeywords || []),
      jdAnalysis.businessContext || ""
    ].some(Boolean);
  const hasResumeAnalysis =
    resumeAnalysis &&
    [
      ...(resumeAnalysis.preservedSections || []),
      ...(resumeAnalysis.evidenceUnits || []),
      ...(resumeAnalysis.strongEvidence || []),
      ...(resumeAnalysis.weakEvidence || [])
    ].some(Boolean);
  const hasValidation =
    validation &&
    [
      ...(validation.unsupportedClaims || []),
      ...(validation.overfitRisks || []),
      ...(validation.toneRisks || []),
      ...(validation.followUps || [])
    ].some(Boolean);

  if (!hasAlignment && !hasJdAnalysis && !hasResumeAnalysis && !hasValidation) {
    return <p className="mt-3 text-sm leading-6 text-slate-700">这次还没有形成可展示的结构化微调建议。</p>;
  }

  return (
    <div className="mt-3 space-y-3">
      {hasAlignment ? (
        <div className="rounded-2xl border border-line bg-white px-4 py-3">
          <div className="text-sm font-medium text-ink">匹配分析</div>
          <div className="mt-3 space-y-2">
            <InsightList title="优势项" items={alignment?.strengths || []} />
            <InsightList title="差距项" items={alignment?.gaps || []} />
            <InsightList title="优先调整点" items={alignment?.priorities || []} />
          </div>
        </div>
      ) : null}

      {hasJdAnalysis ? (
        <div className="rounded-2xl border border-line bg-white px-4 py-3">
          <div className="text-sm font-medium text-ink">JD 解析</div>
          <div className="mt-3 space-y-2">
            <InsightList title="核心职责" items={jdAnalysis?.coreResponsibilities || []} />
            <InsightList title="必备能力" items={jdAnalysis?.mustHaves || []} />
            <InsightList title="加分项" items={jdAnalysis?.bonusSignals || []} />
            <InsightList title="隐含偏好" items={jdAnalysis?.hiddenPreferences || []} />
            <InsightList title="ATS 关键词" items={jdAnalysis?.atsKeywords || []} />
            {jdAnalysis?.businessContext ? (
              <div className="rounded-2xl bg-panel px-4 py-3 text-sm leading-6 text-slate-700">
                <div className="text-xs font-medium text-slate-500">业务语境</div>
                <div className="mt-1">{jdAnalysis.businessContext}</div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {hasResumeAnalysis ? (
        <div className="rounded-2xl border border-line bg-white px-4 py-3">
          <div className="text-sm font-medium text-ink">简历素材拆解</div>
          <div className="mt-3 space-y-2">
            <InsightList title="保留分区" items={resumeAnalysis?.preservedSections || []} />
            <InsightList title="可用证据单元" items={resumeAnalysis?.evidenceUnits || []} />
            <InsightList title="强证据" items={resumeAnalysis?.strongEvidence || []} />
            <InsightList title="弱证据 / 待补强" items={resumeAnalysis?.weakEvidence || []} />
          </div>
        </div>
      ) : null}

      {hasValidation ? (
        <div className="rounded-2xl border border-line bg-white px-4 py-3">
          <div className="text-sm font-medium text-ink">风险校验</div>
          <div className="mt-3 space-y-2">
            <InsightList title="潜在超范围表述" items={validation?.unsupportedClaims || []} />
            <InsightList title="强行贴 JD 风险" items={validation?.overfitRisks || []} />
            <InsightList title="语气 / AI 腔风险" items={validation?.toneRisks || []} />
            <InsightList title="仍需确认" items={validation?.followUps || []} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InsightList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="text-xs font-medium text-slate-500">{title}</div>
      <div className="mt-1 space-y-1">
        {items.map((item, index) => (
          <div key={`${title}-${index}`} className="text-sm leading-6 text-slate-700">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function getOriginalResumePreview(resume: {
  rawText: string | null;
  note: string | null;
  assets: Array<{
    extractedText: string | null;
    fileUrl?: string | null;
    artifactName?: string | null;
    artifactMimeType?: string | null;
    isEditingSource: boolean;
    isPreviewSource?: boolean;
    kind: string;
  }>;
}) {
  const preferredAssetText = resolveResumeText(resume).text;

  if (preferredAssetText) {
    return preferredAssetText;
  }

  if (resume.note?.trim()) {
    return `当前还没有提取到这份简历的正文。\n\n版本备注：${resume.note.trim()}`;
  }

  return "当前还没有提取到这份简历的正文，请先补充版本备注，或换成可复制文字的 PDF / Word / 文本文件。";
}

function OriginalResumePanel({
  resume
}: {
  resume: {
    rawText: string | null;
    note: string | null;
    assets: Array<{
      id: string;
      extractedText: string | null;
      fileUrl: string | null;
      artifactName: string | null;
      artifactMimeType: string | null;
      isEditingSource: boolean;
      isPreviewSource: boolean;
      kind: string;
    }>;
  };
}) {
  const previewAsset =
    resume.assets.find((asset) => asset.isPreviewSource && asset.fileUrl) ||
    chooseResumeAssetSources(resume.assets).previewSource ||
    null;

  if (previewAsset?.fileUrl && previewAsset.kind === "PDF") {
    return (
      <div className="overflow-hidden rounded-2xl border border-line bg-panel">
        <iframe
          src={previewAsset.fileUrl}
          title={previewAsset.artifactName || "原始简历预览"}
          className="h-[720px] w-full bg-white"
        />
        <div className="border-t border-line px-3.5 py-2 text-xs text-slate-500">
          当前优先展示 PDF 预览源，避免正文提取顺序影响原始版本查看。
        </div>
      </div>
    );
  }

  if (previewAsset?.fileUrl && previewAsset.artifactMimeType?.startsWith("image/")) {
    return (
      <div className="overflow-hidden rounded-2xl border border-line bg-panel">
        <img
          src={previewAsset.fileUrl}
          alt={previewAsset.artifactName || "原始简历预览"}
          className="max-h-[720px] w-full object-contain bg-white"
        />
        <div className="border-t border-line px-3.5 py-2 text-xs text-slate-500">当前展示图片预览源。</div>
      </div>
    );
  }

  return (
    <textarea
      readOnly
      value={getOriginalResumePreview(resume)}
      rows={16}
      className="w-full rounded-2xl border border-line bg-panel px-3.5 py-3 text-sm leading-6 outline-none"
    />
  );
}

function isStaleMissingTextRun(aiNote: string | null, summary: string | null, rawText: string | null) {
  if (!rawText?.trim()) {
    return false;
  }

  const note = aiNote || "";
  const resultSummary = summary || "";

  return note.includes("尚未提取到可用正文") || resultSummary.includes("系统还拿不到足够的简历正文");
}

function getTailorRunType({
  staleMissingTextRun,
  draftText
}: {
  staleMissingTextRun: boolean;
  draftText: string;
}) {
  if (staleMissingTextRun) {
    return "待补正文";
  }

  if (draftText.trim()) {
    return "完整草稿";
  }

  return "结构化建议";
}

function getVariantArtifactName(artifactName: string | null, title: string) {
  if (artifactName?.trim()) {
    return artifactName;
  }

  return `${title}.docx`;
}
