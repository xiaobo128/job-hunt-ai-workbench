import { PageShell } from "@/components/app-shell";
import { RecruitmentEventAgentForm } from "@/components/recruitment-event-agent-form";
import { requireSessionUser } from "@/lib/session";

export default async function RecruitmentEventAgentPage() {
  await requireSessionUser();

  return (
    <PageShell title="招聘事件 Agent" description="粘贴招聘邮件或通知文本，提取事件并匹配已有申请；只有唯一 HIGH confidence 匹配才会创建待确认 Proposal。">
      <RecruitmentEventAgentForm />
    </PageShell>
  );
}
