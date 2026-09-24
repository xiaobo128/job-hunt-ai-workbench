import { authenticateAgentRequest } from "@/lib/agent-auth";
import { mcpHandler } from "@/lib/mcp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleMcpRequest(request: Request) {
  const apiToken = await authenticateAgentRequest();

  if (!apiToken) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
  }

  return mcpHandler.fetch(request, {
    authInfo: { clientId: apiToken.user.id, token: "authenticated-api-token", scopes: [] }
  });
}

export const GET = handleMcpRequest;
export const POST = handleMcpRequest;
export const DELETE = handleMcpRequest;
