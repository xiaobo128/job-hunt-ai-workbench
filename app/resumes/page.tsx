import { PageShell } from "@/components/app-shell";
import { Badge } from "@/components/cards";
import { AddResumeDialog } from "@/components/add-resume-dialog";
import { RetryResumeParseForm } from "@/components/retry-resume-parse-form";
import { ResumeNoteInline } from "@/components/resume-note-inline";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { requireSessionUser } from "@/lib/session";

export default async function ResumesPage() {
  const user = await requireSessionUser();
  // The model has no primary flag. The most recently updated record is shown as
  // the active profile; historical records remain intact and intentionally hidden.
  const resume = await prisma.resume.findFirst({
    where: { ownerId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { assets: { orderBy: { createdAt: "asc" } }, parseAttempts: { orderBy: { createdAt: "desc" }, take: 1 } }
  });
  const confirmedParse = resume
    ? await prisma.resumeParse.findFirst({ where: { resumeId: resume.id, status: "CONFIRMED" }, orderBy: { confirmedAt: "desc" }, select: { id: true } })
    : null;

  return (
    <PageShell title="候选人资料" description="维护当前主简历和已确认的事实，帮助你持续推进岗位。" action={<AddResumeDialog />}>
      {!resume ? (
        <div className="rounded-3xl border border-dashed border-line bg-white px-4 py-8 text-center text-sm text-slate-500">还没有主简历。上传一份简历，开始整理候选人资料。</div>
      ) : (
        <section className="rounded-3xl border border-line bg-white px-4 py-3.5 shadow-card">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="text-lg font-semibold text-ink">{resume.title}</h2>
            <Badge>当前主简历</Badge>
            <span className="text-sm text-slate-500">更新于 {formatDate(resume.updatedAt)}</span>
          </div>
          <div className="mt-1.5"><ResumeNoteInline resumeId={resume.id} initialNote={resume.note} /></div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
            {confirmedParse ? <><Badge>已确认</Badge><span>已确认事实，可作为后续岗位准备依据</span><span aria-hidden="true">·</span><a href={`/resumes/${resume.id}/parses/${confirmedParse.id}/review`} className="font-medium text-accent underline-offset-4 hover:underline">查看资料</a></> : resume.parseAttempts[0] ? <ParseStatus resumeId={resume.id} parse={resume.parseAttempts[0]} /> : <span className="text-slate-500">上传主简历后，可在这里确认候选人资料。</span>}
          </div>
        </section>
      )}
    </PageShell>
  );
}

function ParseStatus({ resumeId, parse }: { resumeId: string; parse: { id: string; status: string; errorMessage: string | null } }) {
  if (parse.status === "NEEDS_REVIEW") return <><Badge>待确认</Badge><a href={`/resumes/${resumeId}/parses/${parse.id}/review`} className="font-medium text-accent underline-offset-4 hover:underline">确认候选人资料</a></>;
  if (parse.status === "FAILED") return <><Badge>需要重新处理</Badge>{parse.errorMessage ? <span>{parse.errorMessage}</span> : null}<RetryResumeParseForm failedParseId={parse.id} /></>;
  return <span className="text-slate-500">候选人资料正在准备中。</span>;
}
