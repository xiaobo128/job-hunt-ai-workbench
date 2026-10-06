import Link from "next/link";
import { notFound } from "next/navigation";
import { ProposalCard } from "@/app/proposals/_components/proposal-card";
import { PageShell } from "@/components/app-shell";
import { prisma } from "@/lib/db";
import { ownedProposalWhere } from "@/lib/domain/agent-proposals";
import { requireSessionUser } from "@/lib/session";

export default async function ProposalDetailPage({ params }: { params: Promise<{ proposalId: string }> }) {
  const user = await requireSessionUser();
  const { proposalId } = await params;
  const proposal = await prisma.agentProposal.findFirst({
    where: ownedProposalWhere({ proposalId, userId: user.id }),
    select: {
      id: true, type: true, payloadJson: true, sourceType: true, sourceIdentifier: true, evidenceText: true, status: true, createdAt: true,
      application: { select: { currentStage: true, jobLead: { select: { companyName: true, roleTitle: true } } } }
    }
  });

  if (!proposal) notFound();

  return <PageShell title="确认 Agent 建议" description="请核对这一条建议。状态变更确认后会立即执行，无需回到 Agent 再次操作。" action={<Link href="/proposals" className="inline-flex rounded-2xl border border-line px-4 py-3 text-sm font-medium text-ink">返回待确认事项</Link>}>
    <ProposalCard proposal={proposal} />
  </PageShell>;
}
