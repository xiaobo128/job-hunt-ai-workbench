"use server";

import { AgentProposalType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { confirmAgentProposal, executeConfirmedAgentProposal, rejectAgentProposal } from "@/lib/domain/agent-proposals";
import { requireSessionUser } from "@/lib/session";

function proposalId(formData: FormData) {
  const value = formData.get("proposalId");
  if (typeof value !== "string" || !value.trim()) throw new Error("Invalid proposal");
  return value;
}

export async function confirmProposalAction(formData: FormData) {
  const user = await requireSessionUser();
  const id = proposalId(formData);
  const proposal = await prisma.agentProposal.findFirst({
    where: { id, userId: user.id, application: { jobLead: { ownerId: user.id } } },
    select: { type: true }
  });
  if (!proposal) throw new Error("Invalid proposal");

  await confirmAgentProposal({ userId: user.id, proposalId: id });
  if (proposal.type === AgentProposalType.APPLICATION_STATUS_UPDATE) {
    await executeConfirmedAgentProposal({
      userId: user.id,
      proposalId: id,
      expectedType: AgentProposalType.APPLICATION_STATUS_UPDATE
    });
    revalidatePath("/");
    revalidatePath("/jobs");
  }
  revalidatePath("/proposals");
}

export async function confirmRecruitmentEventProposalAction(formData: FormData) {
  const user = await requireSessionUser();
  const id = proposalId(formData);
  await confirmAgentProposal({ userId: user.id, proposalId: id });
  await executeConfirmedAgentProposal({
    userId: user.id,
    proposalId: id,
    expectedType: AgentProposalType.APPLICATION_EVENT_APPEND
  });
  revalidatePath("/notifications");
  revalidatePath("/proposals");
  redirect("/notifications");
}

export async function rejectProposalAction(formData: FormData) {
  const user = await requireSessionUser();
  await rejectAgentProposal({ userId: user.id, proposalId: proposalId(formData) });
  revalidatePath("/proposals");
}
