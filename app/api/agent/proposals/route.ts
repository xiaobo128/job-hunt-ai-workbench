import { ZodError } from "zod";
import { authenticateAgentRequest } from "@/lib/agent-auth";
import { createAgentProposal } from "@/lib/domain/agent-proposals";
import { ApplicationNotFoundError } from "@/lib/domain/applications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The agent-facing preparation endpoint intentionally creates PENDING proposals only.
 * It has no confirmation or execution capability.
 */
export async function POST(request: Request) {
  const apiToken = await authenticateAgentRequest();
  if (!apiToken) return Response.json({ error: "unauthorized" }, { status: 401, headers: { "WWW-Authenticate": "Bearer" } });

  try {
    const proposal = await createAgentProposal({ userId: apiToken.user.id, input: await request.json() });
    return Response.json({ proposalId: proposal.id, status: proposal.status }, { status: 201 });
  } catch (cause) {
    if (cause instanceof ApplicationNotFoundError) return Response.json({ error: "application_not_found" }, { status: 404 });
    if (cause instanceof ZodError) return Response.json({ error: "invalid_proposal", details: cause.flatten() }, { status: 400 });
    return Response.json({ error: "proposal_create_failed" }, { status: 500 });
  }
}
