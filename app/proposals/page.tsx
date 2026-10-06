import { AgentProposalStatus } from "@prisma/client";
import { PageShell } from "@/components/app-shell";
import { prisma } from "@/lib/db";
import { ownedProposalAccessWhere } from "@/lib/domain/agent-proposals";
import { requireSessionUser } from "@/lib/session";
import { ProposalCard } from "./_components/proposal-card";

export default async function ProposalsPage() {
  const user = await requireSessionUser();
  const proposals = await prisma.agentProposal.findMany({
    where: {
      ...ownedProposalAccessWhere(user.id),
      status: AgentProposalStatus.PENDING,
    },
    select: {
      id: true,
      type: true,
      payloadJson: true,
      sourceType: true,
      sourceIdentifier: true,
      evidenceText: true,
      status: true,
      createdAt: true,
      application: {
        select: {
          currentStage: true,
          jobLead: { select: { companyName: true, roleTitle: true } }
        }
      }
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100
  });

  return (
    <PageShell title="待确认事项" description="确认后，系统会按下方内容更新你的求职记录。">
      <div className="space-y-4">
        {proposals.length === 0 ? (
          <div className="rounded-3xl border border-line bg-white p-6 text-sm text-slate-500 shadow-card">暂无待确认事项。</div>
        ) : (
          proposals.map((proposal) => <ProposalCard key={proposal.id} proposal={proposal} />)
        )}
      </div>
    </PageShell>
  );
}
