import { syncResumeEditingSourceText } from "@/app/actions";
import { PageShell } from "@/components/app-shell";
import { Badge } from "@/components/cards";
import { AddResumeDialog } from "@/components/add-resume-dialog";
import { AddResumeVariantDialog } from "@/components/add-resume-variant-dialog";
import { DeleteResumeAssetForm } from "@/components/delete-resume-asset-form";
import { DeleteResumeForm } from "@/components/delete-resume-form";
import { DeleteResumeVariantForm } from "@/components/delete-resume-variant-form";
import { RetryResumeAssetExtractionForm } from "@/components/retry-resume-asset-extraction-form";
import { RetryResumeParseForm } from "@/components/retry-resume-parse-form";
import { ResumeNoteInline } from "@/components/resume-note-inline";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { getResumes } from "@/lib/queries";
import { isInitialResumeLinkVariant } from "@/lib/resume-linking";
import { getResumeAssetKindLabel, getResumeAssetMatchLabel } from "@/lib/resume-assets";
import { requireSessionUser } from "@/lib/session";

const variantTypeOptions = [
  { value: "ALL", label: "全部版本" },
  { value: "AI_DRAFT", label: "AI 完整草稿" },
  { value: "MANUAL_UPLOAD", label: "手动修改上传" }
] as const;

export default async function ResumesPage({
  searchParams
}: {
  searchParams?: Promise<{ variantType?: string }>;
}) {
  const user = await requireSessionUser();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const variantTypeFilter = getVariantTypeFilter(resolvedSearchParams?.variantType);
  const [resumes, jobs] = await Promise.all([
    getResumes(),
    prisma.jobLead.findMany({
      where: { ownerId: user.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true, companyName: true, roleTitle: true }
    })
  ]);

  const variantIds = resumes.flatMap((resume) => resume.variants.map((variant) => variant.id));
  const agentLinkedVariantIds = new Set(
    variantIds.length === 0
      ? []
      : (
          await prisma.agentRun.findMany({
            where: {
              userId: user.id,
              resumeVariantId: { in: variantIds }
            },
            select: { resumeVariantId: true }
          })
        )
          .map((run) => run.resumeVariantId)
          .filter((value): value is string => Boolean(value))
  );

  const jobOptions = jobs.map((job) => ({
    id: job.id,
    label: `${job.companyName} | ${job.roleTitle}`
  }));

  return (
    <PageShell
      title="简历仓库"
      description="这里统一管理原始简历，以及基于它们生成或上传的定制版本。岗位工作台只管推进，简历文件统一回到这里找。"
      action={<AddResumeDialog />}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {variantTypeOptions.map((option) => {
            const active = variantTypeFilter === option.value;
            const href = option.value === "ALL" ? "/resumes" : `/resumes?variantType=${option.value}`;

            return (
              <a
                key={option.value}
                href={href}
                className={`inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-medium ${
                  active ? "border-ink bg-ink text-white" : "border-line bg-white text-slate-600"
                }`}
              >
                {option.label}
              </a>
            );
          })}
        </div>

        {resumes.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-line bg-white px-4 py-6 text-center text-sm text-slate-500">
            还没有原始简历版本，先上传一份基础版。
          </div>
        ) : null}

        {resumes.map((resume) => {
          const visibleVariants = resume.variants.filter((variant) => !isInitialResumeLinkVariant(variant.note));
          const filteredVariants =
            variantTypeFilter === "ALL"
              ? visibleVariants
              : visibleVariants.filter((variant) => variant.sourceType === variantTypeFilter);
          const linkedJobCount = new Set(
            visibleVariants.map((variant) => variant.jobLeadId).filter((jobLeadId): jobLeadId is string => Boolean(jobLeadId))
          ).size;
          const latestParse = resume.parseAttempts[0] || null;
          const currentConfirmedParse = resume.currentConfirmedParse;

          return (
            <details
              id={`resume-${resume.id}`}
              key={resume.id}
              open={visibleVariants.length > 0}
              className="group scroll-mt-24 rounded-3xl border border-line bg-white p-4 shadow-card"
            >
              <summary className="list-none cursor-pointer">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pr-2">
                      <div className="text-lg font-semibold text-ink">{resume.title}</div>
                      <Badge>原始简历</Badge>
                      <div className="text-sm text-slate-500">创建于 {formatDate(resume.createdAt)}</div>
                      <Badge>{visibleVariants.length} 个定制版本</Badge>
                      <Badge>{linkedJobCount} 个关联岗位</Badge>
                      <Badge>{resume.assets.length} 个源文件</Badge>
                      {latestParse ? <Badge>{getResumeParseStatusLabel(latestParse.status)}</Badge> : null}
                    </div>
                    <div className="mt-3.5">
                      <ResumeNoteInline resumeId={resume.id} initialNote={resume.note} />
                    </div>
                    {latestParse ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                        <span>结构化解析：{getResumeParseStatusLabel(latestParse.status)}</span>
                        {latestParse.status === "NEEDS_REVIEW" ? (
                          <a
                            href={`/resumes/${resume.id}/parses/${latestParse.id}/review`}
                            className="font-medium text-accent underline-offset-4 hover:underline"
                          >
                            去确认结构化字段
                          </a>
                        ) : null}
                        {latestParse.status === "FAILED" && latestParse.errorMessage ? <span>{latestParse.errorMessage}</span> : null}
                        {latestParse.status === "FAILED" ? <RetryResumeParseForm failedParseId={latestParse.id} /> : null}
                      </div>
                    ) : null}
                    {currentConfirmedParse ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                        <span>当前有效结构化版本：已确认</span>
                        <a
                          href={`/resumes/${resume.id}/parses/${currentConfirmedParse.id}/review`}
                          className="font-medium text-accent underline-offset-4 hover:underline"
                        >
                          查看已确认字段
                        </a>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-start gap-2">
                    {resume.assets.length > 0 ? (
                      <form action={syncResumeEditingSourceText}>
                        <input type="hidden" name="resumeId" value={resume.id} />
                        <button
                          type="submit"
                          className="inline-flex h-10 items-center justify-center rounded-xl border border-line bg-white px-4 text-sm font-medium text-ink"
                        >
                          同步编辑源正文
                        </button>
                      </form>
                    ) : null}
                    <AddResumeVariantDialog resumeId={resume.id} jobs={jobOptions} />
                    <DeleteResumeForm resumeId={resume.id} />
                  </div>
                </div>
              </summary>

              <div className="mt-4 border-t border-line pt-4">
                <div className="mb-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-ink">源文件资产</div>
                      <div className="mt-1 text-xs text-slate-500">
                        这里保留该简历已有的 PDF、DOCX、图片或文本源文件。
                      </div>
                    </div>
                    <Badge>{resume.assets.length} 个源文件</Badge>
                  </div>

                  {resume.assets.length === 0 ? (
                    <div className="rounded-2xl bg-panel px-4 py-3 text-sm text-slate-500">
                      这份原始简历当前没有可用的源文件。
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {resume.assets.map((asset) => (
                        <div key={asset.id} className="rounded-2xl border border-line bg-panel p-3.5">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="font-medium text-ink">{asset.artifactName}</div>
                                <Badge>{getResumeAssetKindLabel(asset.kind)}</Badge>
                                {asset.isEditingSource ? <Badge>编辑源</Badge> : null}
                                {asset.isPreviewSource ? <Badge>预览源</Badge> : null}
                                <Badge>{getResumeAssetMatchLabel(asset.matchStatus)}</Badge>
                              </div>
                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500">
                                <span>上传于 {formatDate(asset.createdAt)}</span>
                                {asset.extractedText ? <span>已提取正文</span> : <span>正文待提取</span>}
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-wrap items-center gap-2">
                              <a
                                href={`/api/resume-assets/${asset.id}/download`}
                                className="inline-flex h-10 min-w-[124px] items-center justify-center rounded-xl border border-line bg-white px-4 text-sm font-medium text-ink"
                              >
                                下载源文件
                              </a>
                              {!asset.extractedText && asset.kind !== "PDF" && asset.kind !== "DOCX" ? (
                                <RetryResumeAssetExtractionForm assetId={asset.id} />
                              ) : null}
                              <DeleteResumeAssetForm assetId={asset.id} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-ink">定制版本</div>
                    <div className="mt-1 text-xs text-slate-500">
                      AI 完整草稿和手动上传版本都归档在这里。当前显示{" "}
                      {variantTypeOptions.find((option) => option.value === variantTypeFilter)?.label}.
                    </div>
                  </div>
                  <Badge>{filteredVariants.length} 个版本</Badge>
                </div>

                {filteredVariants.length === 0 ? (
                  <div className="rounded-2xl bg-panel px-4 py-3 text-sm text-slate-500">
                    {visibleVariants.length === 0
                      ? "还没有基于这份原始简历保存过定制版本。"
                      : "当前筛选条件下没有匹配的定制版本。"}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredVariants.map((variant) => (
                      <div id={`variant-${variant.id}`} key={variant.id} className="scroll-mt-24 rounded-2xl border border-line bg-panel p-3.5">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="font-medium text-ink">{variant.title}</div>
                              <Badge>{getVariantSourceLabel(variant.sourceType)}</Badge>
                              {agentLinkedVariantIds.has(variant.id) ? <Badge>外部 Agent</Badge> : null}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500">
                              <span>
                                {variant.jobLead ? `${variant.jobLead.companyName} | ${variant.jobLead.roleTitle}` : "未关联岗位"}
                              </span>
                              <span>保存于 {formatDate(variant.createdAt)}</span>
                            </div>
                            {variant.note ? <p className="mt-2 text-sm leading-6 text-slate-600">{variant.note}</p> : null}
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            {variant.fileUrl ? (
                              <a
                                href={`/api/resume-variants/${variant.id}/download`}
                                className="inline-flex h-10 min-w-[124px] items-center justify-center rounded-xl border border-line bg-white px-4 text-sm font-medium text-ink"
                              >
                                下载文件
                              </a>
                            ) : variant.draftText ? (
                              <span className="inline-flex h-10 min-w-[124px] items-center justify-center rounded-xl border border-dashed border-line bg-white px-4 text-sm text-slate-500">
                                仅保存正文
                              </span>
                            ) : null}
                            <DeleteResumeVariantForm variantId={variant.id} />
                          </div>
                        </div>
                        {variant.draftText ? (
                          <details className="mt-3">
                            <summary className="cursor-pointer text-sm font-medium text-accent">查看 AI 草稿正文</summary>
                            <pre className="mt-3 whitespace-pre-wrap rounded-2xl bg-white p-3 text-sm leading-5 text-slate-700">
                              {variant.draftText}
                            </pre>
                          </details>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </PageShell>
  );
}

function getVariantSourceLabel(sourceType: string) {
  if (sourceType === "AI_DRAFT") {
    return "AI 完整草稿";
  }

  return "手动修改上传";
}

function getResumeParseStatusLabel(status: string) {
  switch (status) {
    case "PROCESSING":
      return "解析中";
    case "NEEDS_REVIEW":
      return "待结构化确认";
    case "FAILED":
      return "解析失败";
    case "CONFIRMED":
      return "已确认";
    case "SUPERSEDED":
      return "已替代";
    default:
      return status;
  }
}

function getVariantTypeFilter(value: string | undefined) {
  return variantTypeOptions.some((option) => option.value === value) ? value : "ALL";
}
