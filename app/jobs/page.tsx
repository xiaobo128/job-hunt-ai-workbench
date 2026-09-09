import { PageShell } from "@/components/app-shell";
import { AddJobDialog } from "@/components/add-job-dialog";
import { JobsListClient } from "@/components/jobs-list-client";
import { prisma } from "@/lib/db";
import { getJobs } from "@/lib/queries";
import { isInitialResumeLinkVariant } from "@/lib/resume-linking";
import { requireSessionUser } from "@/lib/session";

export default async function JobsPage({
  searchParams
}: {
  searchParams: Promise<{ view?: string; q?: string; status?: string; city?: string; source?: string }>;
}) {
  const user = await requireSessionUser();
  const [jobs, resumes, resumeVariants] = await Promise.all([
    getJobs(),
    prisma.resume.findMany({
      where: { ownerId: user.id },
      select: {
        id: true,
        title: true
      },
      orderBy: [{ updatedAt: "desc" }]
    }),
    prisma.resumeVariant.findMany({
      where: { resume: { ownerId: user.id } },
      include: {
        resume: {
          select: {
            id: true,
            title: true
          }
        },
        jobLead: {
          select: {
            id: true,
            companyName: true,
            roleTitle: true
          }
        }
      },
      orderBy: [{ updatedAt: "desc" }]
    })
  ]);
  const { view, q, status, city, source } = await searchParams;

  return (
    <PageShell
      title="岗位工作台"
      description="统一管理岗位信息、推进状态和备注。表格适合集中维护，看板适合按阶段快速扫一遍。"
      action={<AddJobDialog />}
    >
      <JobsListClient
        jobs={jobs.map((job) => ({
          ...job,
          linkedResumeVariant: job.resumeVariants[0]
            ? isInitialResumeLinkVariant(job.resumeVariants[0].note)
              ? {
                  optionId: "resume:" + job.resumeVariants[0].resume.id,
                  title: job.resumeVariants[0].resume.title,
                  href: "/resumes#resume-" + job.resumeVariants[0].resume.id,
                  resumeId: job.resumeVariants[0].resume.id
                }
              : {
                  optionId: "variant:" + job.resumeVariants[0].id,
                  title: job.resumeVariants[0].title,
                  href: "/resumes#variant-" + job.resumeVariants[0].id,
                  resumeId: job.resumeVariants[0].resume.id
                }
            : null
        }))}
        resumeVariantOptions={[
          ...resumes.map((resume) => ({
            optionId: "resume:" + resume.id,
            kind: "resume" as const,
            title: resume.title,
            resumeId: resume.id,
            resumeTitle: resume.title,
            jobLeadId: null,
            jobLabel: null
          })),
          ...resumeVariants
            .filter((variant) => !isInitialResumeLinkVariant(variant.note))
            .map((variant) => ({
              optionId: "variant:" + variant.id,
              kind: "variant" as const,
              title: variant.title,
              resumeId: variant.resume.id,
              resumeTitle: variant.resume.title,
              jobLeadId: variant.jobLead?.id || null,
              jobLabel: variant.jobLead ? variant.jobLead.companyName + " | " + variant.jobLead.roleTitle : null
            }))
        ]}
        initialView={view === "board" ? "board" : "table"}
        initialQuery={q || ""}
        initialStatus={status || "ALL"}
        initialCity={city || "ALL"}
        initialSource={source || "ALL"}
      />
    </PageShell>
  );
}
