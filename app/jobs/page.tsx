import { PageShell } from "@/components/app-shell";
import { AddJobDialog } from "@/components/add-job-dialog";
import { JobsListClient } from "@/components/jobs-list-client";
import { prisma } from "@/lib/db";
import { requireSessionUser } from "@/lib/session";

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ view?: string; q?: string; status?: string; city?: string; source?: string }> }) {
  const user = await requireSessionUser();
  const [jobs, resumes, { view, q, status, city, source }] = await Promise.all([
    prisma.jobLead.findMany({
      where: { ownerId: user.id },
      select: {
        id: true, companyName: true, roleTitle: true, city: true, industry: true, seniority: true, sourceName: true, sourceUrl: true,
        parsedSummary: true, rawContent: true, needsReview: true, skills: true, status: true, updatedAt: true,
        application: {
          select: {
            id: true,
            currentStage: true,
            submissionChannel: true,
            nextAction: true,
            note: true,
            appliedAt: true,
            usedResume: { select: { id: true, title: true, isPrimary: true } },
            updatedAt: true,
            events: {
              select: { eventType: true, title: true, eventTime: true, createdAt: true },
              orderBy: [{ eventTime: "desc" }, { createdAt: "desc" }],
              take: 10
            }
          }
        }
      },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.resume.findMany({
      where: { ownerId: user.id, parseAttempts: { some: { status: "CONFIRMED" } } },
      select: { id: true, title: true, isPrimary: true },
      orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }]
    }),
    searchParams
  ]);

  return <PageShell title="岗位工作台" description="围绕岗位、进度、事件和下一步，持续推进你的求职。" action={<div className="flex items-center gap-2"><a href="/api/jobs/export" className="inline-flex h-9 items-center rounded-lg border border-line bg-white px-3.5 text-sm font-medium text-ink transition-colors hover:bg-slate-50">导出 Excel</a><AddJobDialog /></div>}>
    <JobsListClient jobs={jobs} resumes={resumes} initialView={view === "board" ? "board" : "table"} initialQuery={q || ""} initialStatus={status || "ALL"} initialCity={city || "ALL"} initialSource={source || "ALL"} />
  </PageShell>;
}
