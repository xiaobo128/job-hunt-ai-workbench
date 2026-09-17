import { PageShell } from "@/components/app-shell";
import { Badge } from "@/components/cards";
import { AddResumeDialog } from "@/components/add-resume-dialog";
import { ResumeVersionActions } from "@/components/resume-version-actions";
import { RetryResumeParseForm } from "@/components/retry-resume-parse-form";
import { ResumeNoteInline } from "@/components/resume-note-inline";
import { formatDate } from "@/lib/format";
import { getResumes } from "@/lib/queries";

export default async function ResumesPage() {
  const resumes = await getResumes();

  return (
    <PageShell title="简历仓库" description="管理不同简历版本与已确认的结构化信息。" action={<AddResumeDialog />}>
      {resumes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-white px-4 py-7 text-center text-sm text-slate-500">还没有简历版本。新增一份简历版本，开始整理候选人资料。</div>
      ) : (
        <div className="space-y-2">
          {resumes.map((resume) => <ResumeVersionCard key={resume.id} resume={resume} isCurrent={resume.isPrimary} />)}
        </div>
      )}
    </PageShell>
  );
}

function ResumeVersionCard({ resume, isCurrent }: { resume: Awaited<ReturnType<typeof getResumes>>[number]; isCurrent: boolean }) {
  const confirmedParse = resume.currentConfirmedParse;
  const latestParse = resume.parseAttempts[0];
  const needsReviewParse = latestParse?.status === "NEEDS_REVIEW" ? latestParse : null;
  return <section className="rounded-xl border border-line bg-white px-4 py-3 transition-colors hover:border-slate-300">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
        <h2 className="text-base font-semibold text-ink">{resume.title}</h2>
        {isCurrent ? <Badge>当前主简历</Badge> : <Badge>简历版本</Badge>}
        <ResumeParseStatus confirmedParse={confirmedParse} parse={latestParse} />
      </div>
      <div className="flex shrink-0 items-center gap-1 text-sm text-slate-500"><span>更新于 {formatDate(resume.updatedAt)}</span>{!isCurrent ? <ResumeVersionActions resumeId={resume.id} reviewHref={needsReviewParse ? `/resumes/${resume.id}/parses/${needsReviewParse.id}/review` : undefined} canSetCurrent={Boolean(confirmedParse) && !needsReviewParse} /> : null}</div>
    </div>
    <div className="mt-2 flex min-w-0 items-center justify-between gap-3">
      <div className="min-w-0 flex-1"><ResumeNoteInline resumeId={resume.id} initialNote={resume.note} /></div>
      <ResumeParseAction resumeId={resume.id} confirmedParse={confirmedParse} parse={latestParse} />
    </div>
  </section>;
}

function ResumeParseStatus({ confirmedParse, parse }: { confirmedParse: { id: string } | null; parse: { id: string; status: string; errorMessage: string | null } | undefined }) {
  if (confirmedParse) return <><Badge>已确认</Badge><span className="text-sm text-slate-500">已确认事实，可作为后续岗位准备依据</span></>;
  if (parse?.status === "NEEDS_REVIEW") return <><Badge>待确认</Badge><span className="text-sm text-slate-500">尚未确认候选人资料</span></>;
  if (parse?.status === "FAILED") return <><Badge>需要重新处理</Badge><span className="max-w-64 truncate text-sm text-slate-500">{parse.errorMessage || "候选人资料解析失败"}</span></>;
  return <span className="text-sm text-slate-500">{parse ? "候选人资料正在准备中" : "未生成候选人资料"}</span>;
}

function ResumeParseAction({ resumeId, confirmedParse, parse }: { resumeId: string; confirmedParse: { id: string } | null; parse: { id: string; status: string; errorMessage: string | null } | undefined }) {
  if (confirmedParse) return <a href={`/resumes/${resumeId}/parses/${confirmedParse.id}/review`} className="shrink-0 text-sm font-medium text-accent underline-offset-4 hover:underline">查看资料</a>;
  if (parse?.status === "NEEDS_REVIEW") return <a href={`/resumes/${resumeId}/parses/${parse.id}/review`} className="shrink-0 text-sm font-medium text-accent underline-offset-4 hover:underline">确认候选人资料</a>;
  if (parse?.status === "FAILED") return <div className="shrink-0"><RetryResumeParseForm failedParseId={parse.id} /></div>;
  return <span className="shrink-0 text-sm text-slate-400">{parse ? "资料准备中" : "暂无可确认资料"}</span>;
}
