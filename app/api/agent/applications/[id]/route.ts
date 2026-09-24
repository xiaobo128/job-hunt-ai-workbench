import { AgentRunKind, AgentRunSource, AgentRunStatus, ApplicationStage } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseAgentJson, requireAgentAuth, serverError } from "@/lib/agent-api";
import { completeAgentRunLog, createAgentRunLog } from "@/lib/agent-auth";
import { agentApplicationPatchSchema } from "@/lib/agent-schemas";
import { updateApplicationStatus } from "@/lib/domain/applications";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAgentAuth();

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await params;
  const parsed = await parseAgentJson(request, agentApplicationPatchSchema);

  if (!parsed.ok) {
    return parsed.response;
  }

  const body = parsed.data;

  const application = await prisma.application.findFirst({
    where: {
      id,
      jobLead: { ownerId: auth.user.id }
    }
  });

  if (!application) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const requestedStage = (body.currentStage || body.stage) as ApplicationStage;
  const note = body.note;

  const run = await createAgentRunLog({
    userId: auth.user.id,
    kind: AgentRunKind.STATUS_SYNC,
    source: AgentRunSource.API,
    status: AgentRunStatus.PENDING,
    input: body,
    jobLeadId: application.jobLeadId
  });

  try {
    const updatedApplication = await updateApplicationStatus({
      userId: auth.user.id,
      applicationId: application.id,
      requestedStage,
      note: note === undefined ? undefined : note || null
    });

    await completeAgentRunLog({
      agentRunId: run.id,
      status: AgentRunStatus.SUCCEEDED,
      output: {
        applicationId: updatedApplication.id,
        currentStage: updatedApplication.currentStage
      }
    });

    return NextResponse.json({
      ok: true,
      application: {
        id: updatedApplication.id,
        currentStage: updatedApplication.currentStage,
        note: updatedApplication.note
      }
    });
  } catch (error) {
    await completeAgentRunLog({
      agentRunId: run.id,
      status: AgentRunStatus.FAILED,
      errorMessage: error instanceof Error ? error.message : "Failed to update application stage."
    });
    return serverError("Failed to update application stage.");
  }
}
