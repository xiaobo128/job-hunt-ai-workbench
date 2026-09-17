import { notFound } from "next/navigation";
import { PageShell } from "@/components/app-shell";
import { ResumeParseReviewActions, ResumeParseReviewForm } from "@/components/resume-parse-review-form";
import { prisma } from "@/lib/db";
import { ResumeDocumentSchema } from "@/lib/resume-parsing/core";
import { requireSessionUser } from "@/lib/session";

export default async function ResumeParseReviewPage({
  params
}: {
  params: Promise<{ id: string; parseId: string }>;
}) {
  const user = await requireSessionUser();
  const { id: resumeId, parseId } = await params;
  const parse = await prisma.resumeParse.findFirst({
    where: {
      id: parseId,
      resumeId,
      status: { in: ["NEEDS_REVIEW", "CONFIRMED", "SUPERSEDED"] },
      resume: { ownerId: user.id }
    },
    select: {
      id: true,
      resumeId: true,
      documentJson: true,
      status: true,
      resume: { select: { id: true, title: true, ownerId: true } },
      resumeAsset: {
        select: { id: true, resumeId: true, artifactName: true, artifactMimeType: true, kind: true }
      }
    }
  });

  // Keep the authorization check explicit: the URL, parse, asset, resume and user must all agree.
  if (
    !parse ||
    parse.resumeId !== resumeId ||
    parse.resume.id !== resumeId ||
    parse.resume.ownerId !== user.id ||
    parse.resumeAsset.resumeId !== resumeId
  ) {
    notFound();
  }

  if (parse.status !== "NEEDS_REVIEW" && parse.status !== "CONFIRMED" && parse.status !== "SUPERSEDED") {
    notFound();
  }

  const parsedDocument = ResumeDocumentSchema.safeParse(parse.documentJson);
  if (!parsedDocument.success) {
    notFound();
  }

  const isPdf = parse.resumeAsset.kind === "PDF";
  const isEditable = parse.status === "NEEDS_REVIEW";

  return (
    <PageShell
      title={isEditable ? "确认结构化简历" : "查看结构化简历"}
      className="xl:grid xl:h-[calc(100dvh-2rem)] xl:grid-rows-[auto_minmax(0,1fr)] xl:gap-4 xl:space-y-0"
      description={
        isEditable
          ? "请核对原始文件和系统提取的字段。确认无误后，使用右上角保存并确认。"
          : parse.status === "CONFIRMED"
            ? "这是当前有效的已确认结构化简历，仅供查看。"
            : "这个结构化版本已被后续确认版本替代，仅供查看。"
      }
      action={<ResumeParseReviewActions editable={isEditable} />}
    >
      <div className="grid gap-5 xl:min-h-0 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="rounded-3xl border border-line bg-white p-4 shadow-card xl:sticky xl:top-0 xl:flex xl:h-full xl:min-h-0 xl:flex-col">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-ink">原始文件</h2>
              <p className="mt-1 break-all text-sm text-slate-500">{parse.resumeAsset.artifactName}</p>
            </div>
            <a
              href={`/api/resume-assets/${parse.resumeAsset.id}/download`}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-line px-4 text-sm font-medium text-ink"
            >
              下载原文件
            </a>
          </div>
          {isPdf ? (
            <iframe
              title={`${parse.resume.title} 原始简历`}
              src={`/api/resume-assets/${parse.resumeAsset.id}/download?disposition=inline`}
              className="mt-4 h-[720px] w-full rounded-2xl border border-line bg-panel xl:h-auto xl:min-h-0 xl:flex-1"
            />
          ) : (
            <div className="mt-4 rounded-2xl bg-panel p-5 text-sm leading-6 text-slate-600">
              此文件格式暂不支持页内预览。请下载原文件，与右侧结构化字段逐项核对。
            </div>
          )}
        </section>
        <div className="xl:min-h-0 xl:overflow-y-auto xl:pr-1">
          <ResumeParseReviewForm
            resumeId={resumeId}
            parseId={parse.id}
            status={parse.status}
            document={parsedDocument.data}
          />
        </div>
      </div>
    </PageShell>
  );
}
