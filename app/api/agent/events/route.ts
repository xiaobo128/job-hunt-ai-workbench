import { AgentRunKind, AgentRunSource, AgentRunStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseAgentJson, requireAgentAuth, serverError } from "@/lib/agent-api";
import { completeAgentRunLog, createAgentRunLog } from "@/lib/agent-auth";
import { agentEventCreateSchema } from "@/lib/agent-schemas";
import { appendApplicationEvent } from "@/lib/domain/applications";

export async function POST(request: Request) {
  const auth = await requireAgentAuth();

  if (!auth.ok) {
    return auth.response;
  }

  const parsed = await parseAgentJson(request, agentEventCreateSchema);

  if (!parsed.ok) {
    return parsed.response;
  }

  const body = parsed.data;
  const applicationId = body.applicationId;

  const application = await prisma.application.findFirst({
    where: {
      id: applicationId,
      jobLead: { ownerId: auth.user.id }
    }
  });

  if (!application) {
    return NextResponse.json({ ok: false, error: "application_not_found" }, { status: 404 });
  }

  const run = await createAgentRunLog({
    userId: auth.user.id,
    kind: AgentRunKind.NOTIFICATION_IMPORT,
    source: AgentRunSource.API,
    status: AgentRunStatus.PENDING,
    input: body,
    jobLeadId: application.jobLeadId
  });

  try {
    const event = await appendApplicationEvent({
      userId: auth.user.id,
      applicationId,
      aiProvider: body.provider || "external-agent",
      aiNote: body.aiNote || "Written through the external agent API.",
      eventType: body.eventType,
      eventTime: body.eventTime ? new Date(body.eventTime) : null,
      title: body.title,
      artifactName: body.artifactName || null,
      artifactUrl: body.artifactUrl || null,
      detailsJson: JSON.stringify({
        content: body.content || "",
        requirements: body.requirements
      })
    });

    await completeAgentRunLog({
      agentRunId: run.id,
      status: AgentRunStatus.SUCCEEDED,
      output: { eventId: event.id, eventType: event.eventType },
      eventId: event.id
    });

    return NextResponse.json({
      ok: true,
      event: {
        id: event.id,
        eventType: event.eventType,
        title: event.title
      }
    });
  } catch (error) {
    await completeAgentRunLog({
      agentRunId: run.id,
      status: AgentRunStatus.FAILED,
      errorMessage: error instanceof Error ? error.message : "Failed to create event."
    });
    return serverError("Failed to create event.");
  }
}
