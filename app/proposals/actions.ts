"use server";

import { AgentProposalType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { confirmAgentProposal, executeConfirmedAgentProposal, ownedProposalWhere, rejectAgentProposal } from "@/lib/domain/agent-proposals";
import { requireSessionUser } from "@/lib/session";

function proposalId(formData: FormData) {
  const value = formData.get("proposalId");
  if (typeof value !== "string" || !value.trim()) throw new Error("Invalid proposal");
  return value;
}

export async function confirmProposalAction(formData: FormData) {
  const user = await requireSessionUser();
  const id = proposalId(formData);
  await requireOwnedProposalType(user.id, id, AgentProposalType.APPLICATION_STATUS_UPDATE);

  await confirmAgentProposal({ userId: user.id, proposalId: id });
  await executeConfirmedAgentProposal({
    userId: user.id,
    proposalId: id,
    expectedType: AgentProposalType.APPLICATION_STATUS_UPDATE
  });
  revalidatePath("/");
  revalidatePath("/jobs");
  revalidatePath("/proposals");
  revalidatePath(`/proposals/${id}`);
}

export async function confirmJobApplicationCreateProposalAction(formData: FormData) {
  const user = await requireSessionUser();
  const id = proposalId(formData);
  await requireOwnedProposalType(user.id, id, AgentProposalType.JOB_APPLICATION_CREATE);
  await confirmAgentProposal({ userId: user.id, proposalId: id });
  const created = await executeConfirmedAgentProposal({
    userId: user.id,
    proposalId: id,
    expectedType: AgentProposalType.JOB_APPLICATION_CREATE
  });
  revalidatePath("/");
  revalidatePath("/jobs");
  revalidatePath("/board");
  revalidatePath("/proposals");
  redirect(`/jobs/${created.jobLeadId}`);
}

export async function confirmRecruitmentEventProposalAction(formData: FormData) {
  const user = await requireSessionUser();
  const id = proposalId(formData);
  await requireOwnedProposalType(user.id, id, AgentProposalType.APPLICATION_EVENT_APPEND);
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
  const id = proposalId(formData);
  await rejectAgentProposal({ userId: user.id, proposalId: id });
  revalidatePath("/proposals");
  revalidatePath(`/proposals/${id}`);
}

async function requireOwnedProposalType(userId: string, id: string, type: AgentProposalType) {
  const proposal = await prisma.agentProposal.findFirst({
    where: { ...ownedProposalWhere({ proposalId: id, userId }), type },
    select: { id: true }
  });
  if (!proposal) throw new Error("Invalid proposal");
}
