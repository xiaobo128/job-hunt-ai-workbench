import { createHash, randomBytes } from "crypto";
import { headers } from "next/headers";
import { type AgentRunKind, type AgentRunSource, type AgentRunStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

const TOKEN_PREFIX = "jha_";

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function generateApiTokenValue() {
  return `${TOKEN_PREFIX}${randomBytes(24).toString("hex")}`;
}

export async function getBearerTokenFromHeaders() {
  const headerStore = await headers();
  const authorization = headerStore.get("authorization") || headerStore.get("Authorization") || "";

  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim() || null;
}

export async function authenticateAgentRequest() {
  const token = await getBearerTokenFromHeaders();

  if (!token) {
    return null;
  }

  const tokenHash = sha256(token);
  const apiToken = await prisma.apiToken.findFirst({
    where: {
      tokenHash,
      revokedAt: null
    },
    include: {
      user: true
    }
  });

  if (!apiToken) {
    return null;
  }

  await prisma.apiToken.update({
    where: { id: apiToken.id },
    data: { lastUsedAt: new Date() }
  });

  return apiToken;
}

export async function createAgentRunLog({
  userId,
  kind,
  source,
  status = "PENDING",
  input,
  jobLeadId,
  resumeId,
  resumeVariantId,
  eventId
}: {
  userId: string;
  kind: AgentRunKind;
  source: AgentRunSource;
  status?: AgentRunStatus;
  input?: unknown;
  jobLeadId?: string | null;
  resumeId?: string | null;
  resumeVariantId?: string | null;
  eventId?: string | null;
}) {
  return prisma.agentRun.create({
    data: {
      userId,
      kind,
      source,
      status,
      inputJson: input === undefined ? null : JSON.stringify(input),
      jobLeadId: jobLeadId || null,
      resumeId: resumeId || null,
      resumeVariantId: resumeVariantId || null,
      eventId: eventId || null
    }
  });
}

export async function completeAgentRunLog({
  agentRunId,
  status,
  output,
  errorMessage,
  jobLeadId,
  resumeId,
  resumeVariantId,
  eventId
}: {
  agentRunId: string;
  status: AgentRunStatus;
  output?: unknown;
  errorMessage?: string | null;
  jobLeadId?: string | null;
  resumeId?: string | null;
  resumeVariantId?: string | null;
  eventId?: string | null;
}) {
  return prisma.agentRun.update({
    where: { id: agentRunId },
    data: {
      status,
      outputJson: output === undefined ? null : JSON.stringify(output),
      errorMessage: errorMessage || null,
      jobLeadId: jobLeadId === undefined ? undefined : jobLeadId,
      resumeId: resumeId === undefined ? undefined : resumeId,
      resumeVariantId: resumeVariantId === undefined ? undefined : resumeVariantId,
      eventId: eventId === undefined ? undefined : eventId
    }
  });
}
