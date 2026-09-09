import { AgentRunKind, AgentRunSource, AgentRunStatus, ApplicationStage } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseAgentJson, requireAgentAuth, serverError } from "@/lib/agent-api";
import { completeAgentRunLog, createAgentRunLog } from "@/lib/agent-auth";
import { agentJobCreateSchema } from "@/lib/agent-schemas";

export async function POST(request: Request) {
  const auth = await requireAgentAuth();

  if (!auth.ok) {
    return auth.response;
  }

  const parsed = await parseAgentJson(request, agentJobCreateSchema);

  if (!parsed.ok) {
    return parsed.response;
  }

  const body = parsed.data;
  const stage = body.initialStage || body.status || ApplicationStage.READY_TO_APPLY;

  const run = await createAgentRunLog({
    userId: auth.user.id,
    kind: AgentRunKind.JOB_IMPORT,
    source: AgentRunSource.API,
    status: AgentRunStatus.PENDING,
    input: body
  });

  try {
    const created = await prisma.jobLead.create({
      data: {
        ownerId: auth.user.id,
        parseProvider: "external-agent",
        parseNote: body.note || "Written through the external agent API.",
        needsReview: false,
        reviewedAt: new Date(),
        sourceType: body.sourceType,
        sourceName: body.sourceName || null,
        sourceUrl: body.sourceUrl || null,
        companyName: body.companyName,
        roleTitle: body.roleTitle,
        city: body.city || null,
        seniority: body.seniority || null,
        salaryRange: body.salaryRange || null,
        skills: JSON.stringify(body.skills),
        responsibilities: JSON.stringify(body.responsibilities),
        requirements: JSON.stringify(body.requirements),
        rawContent: body.rawContent,
        parsedSummary: body.parsedSummary || null,
        status: stage,
        application: {
          create: {
            currentStage: stage,
            appliedAt: stage === ApplicationStage.APPLIED ? new Date() : null,
            note: body.applicationNote || null
          }
        }
      },
      include: {
        application: true
      }
    });

    await completeAgentRunLog({
      agentRunId: run.id,
      status: AgentRunStatus.SUCCEEDED,
      output: {
        jobLeadId: created.id,
        applicationId: created.application?.id || null
      },
      jobLeadId: created.id
    });

    return NextResponse.json({
      ok: true,
      jobLead: {
        id: created.id,
        companyName: created.companyName,
        roleTitle: created.roleTitle,
        status: created.status
      },
      application: created.application
        ? {
            id: created.application.id,
            currentStage: created.application.currentStage
          }
        : null
    });
  } catch (error) {
    await completeAgentRunLog({
      agentRunId: run.id,
      status: AgentRunStatus.FAILED,
      errorMessage: error instanceof Error ? error.message : "Failed to create job lead."
    });
    return serverError("Failed to create job lead.");
  }
}
