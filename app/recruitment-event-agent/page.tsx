import { PageShell } from "@/components/app-shell";
import { RecruitmentEventAgentForm } from "@/components/recruitment-event-agent-form";
import { prisma } from "@/lib/db";
import { requireSessionUser } from "@/lib/session";

export default async function RecruitmentEventAgentPage() {
  const user = await requireSessionUser();
  const applications = await prisma.application.findMany({
    where: {
      currentStage: { notIn: ["CLOSED", "REJECTED"] },
      jobLead: { ownerId: user.id, status: { notIn: ["CLOSED", "REJECTED"] } }
    },
    select: { id: true, jobLead: { select: { companyName: true, roleTitle: true } } },
    orderBy: { updatedAt: "desc" }
  });

  return (
    <PageShell title="招聘事件 Agent" description="选择关联申请并粘贴招聘通知，AI 提取事件信息后创建待确认 Proposal。">
      <RecruitmentEventAgentForm applications={applications.map((application) => ({ id: application.id, label: `${application.jobLead.companyName} · ${application.jobLead.roleTitle}` }))} />
    </PageShell>
  );
}
