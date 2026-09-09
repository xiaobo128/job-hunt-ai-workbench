import { AgentRunKind, AgentRunSource, AgentRunStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseAgentJson, requireAgentAuth, serverError } from "@/lib/agent-api";
import { completeAgentRunLog, createAgentRunLog } from "@/lib/agent-auth";
import { agentResumeVariantCreateSchema } from "@/lib/agent-schemas";

export async function POST(request: Request) {
  const auth = await requireAgentAuth();

  if (!auth.ok) {
    return auth.response;
  }

  const parsed = await parseAgentJson(request, agentResumeVariantCreateSchema);

  if (!parsed.ok) {
    return parsed.response;
  }

  const body = parsed.data;
  const resumeId = body.resumeId;

  const resume = await prisma.resume.findFirst({
    where: {
      id: resumeId,
      ownerId: auth.user.id
    }
  });

  if (!resume) {
    return NextResponse.json({ ok: false, error: "resume_not_found" }, { status: 404 });
  }

  const jobLeadId = body.jobLeadId || null;

  if (jobLeadId) {
    const job = await prisma.jobLead.findFirst({
      where: { id: jobLeadId, ownerId: auth.user.id },
      select: { id: true }
    });

    if (!job) {
      return NextResponse.json({ ok: false, error: "job_not_found" }, { status: 404 });
    }
  }

  const run = await createAgentRunLog({
    userId: auth.user.id,
    kind: AgentRunKind.RESUME_VARIANT_IMPORT,
    source: AgentRunSource.API,
    status: AgentRunStatus.PENDING,
    input: body,
    resumeId,
    jobLeadId
  });

  try {
    const variant = await prisma.resumeVariant.create({
      data: {
        resumeId,
        jobLeadId,
        sourceType: body.sourceType,
        title: body.title,
        note: body.note || "Imported through the external agent API.",
        fileUrl: body.fileUrl || null,
        artifactName: body.artifactName || null,
        artifactMimeType: body.artifactMimeType || null,
        draftText: body.draftText || null
      }
    });

    await completeAgentRunLog({
      agentRunId: run.id,
      status: AgentRunStatus.SUCCEEDED,
      output: { resumeVariantId: variant.id },
      resumeVariantId: variant.id
    });

    return NextResponse.json({
      ok: true,
      resumeVariant: {
        id: variant.id,
        title: variant.title,
        sourceType: variant.sourceType
      }
    });
  } catch (error) {
    await completeAgentRunLog({
      agentRunId: run.id,
      status: AgentRunStatus.FAILED,
      errorMessage: error instanceof Error ? error.message : "Failed to create resume variant."
    });
    return serverError("Failed to create resume variant.");
  }
}
