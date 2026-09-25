"use server";

import { revalidatePath } from "next/cache";
import { confirmAgentProposal, rejectAgentProposal } from "@/lib/domain/agent-proposals";
import { requireSessionUser } from "@/lib/session";

function proposalId(formData: FormData) {
  const value = formData.get("proposalId");
  if (typeof value !== "string" || !value.trim()) throw new Error("Invalid proposal");
  return value;
}

export async function confirmProposalAction(formData: FormData) {
  const user = await requireSessionUser();
  await confirmAgentProposal({ userId: user.id, proposalId: proposalId(formData) });
  revalidatePath("/proposals");
}

export async function rejectProposalAction(formData: FormData) {
  const user = await requireSessionUser();
  await rejectAgentProposal({ userId: user.id, proposalId: proposalId(formData) });
  revalidatePath("/proposals");
}
