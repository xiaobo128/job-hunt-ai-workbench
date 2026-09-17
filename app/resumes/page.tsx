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
  const needsReviewParse = resume.parseAttempts[0]?.status === "NEEDS_REVIEW" ? resume.parseAttempts[0] : null;
  return <section className="rounded-xl border border-line bg-white px-4 py-3 transition-colors hover:border-slate-300">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <h2 className="text-base font-semibold text-ink">{resume.title}</h2>
        {isCurrent ? <Badge>当前主简历</Badge> : <Badge>简历版本</Badge>}
        <span className="text-sm text-slate-500">更新于 {formatDate(resume.updatedAt)}</span>
      </div>
      {!isCurrent ? <ResumeVersionActions resumeId={resume.id} reviewHref={needsReviewParse ? `/resumes/${resume.id}/parses/${needsReviewParse.id}/review` : undefined} canSetCurrent={Boolean(confirmedParse) && !needsReviewParse} /> : null}
    </div>
    <div className="mt-1.5"><ResumeNoteInline resumeId={resume.id} initialNote={resume.note} /></div>
    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
      {confirmedParse ? <><Badge>已确认</Badge><span>已确认事实，可作为后续岗位准备依据</span><span aria-hidden="true">·</span><a href={`/resumes/${resume.id}/parses/${confirmedParse.id}/review`} className="font-medium text-accent underline-offset-4 hover:underline">查看资料</a></> : resume.parseAttempts[0] ? <ParseStatus resumeId={resume.id} parse={resume.parseAttempts[0]} /> : <span className="text-slate-500">新增简历版本后，可在这里确认候选人资料。</span>}
    </div>
  </section>;
}

function ParseStatus({ resumeId, parse }: { resumeId: string; parse: { id: string; status: string; errorMessage: string | null } }) {
  if (parse.status === "NEEDS_REVIEW") return <><Badge>待确认</Badge><a href={`/resumes/${resumeId}/parses/${parse.id}/review`} className="font-medium text-accent underline-offset-4 hover:underline">确认候选人资料</a></>;
  if (parse.status === "FAILED") return <><Badge>需要重新处理</Badge>{parse.errorMessage ? <span>{parse.errorMessage}</span> : null}<RetryResumeParseForm failedParseId={parse.id} /></>;
  return <span className="text-slate-500">候选人资料正在准备中。</span>;
}
