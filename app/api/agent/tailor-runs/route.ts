import { AgentRunKind, AgentRunSource, AgentRunStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseAgentJson, requireAgentAuth, serverError } from "@/lib/agent-api";
import { completeAgentRunLog, createAgentRunLog } from "@/lib/agent-auth";
import { agentTailorRunCreateSchema } from "@/lib/agent-schemas";
import { ResumeAnalysisEnvelopeSchema, validateResumeAnalysisEvidence } from "@/lib/resume-analysis";
import { ConfirmedResumeDocumentError, loadConfirmedResumeDocument } from "@/lib/resume-parsing/confirmed";

export async function POST(request: Request) {
  const auth = await requireAgentAuth();

  if (!auth.ok) {
    return auth.response;
  }

  const parsed = await parseAgentJson(request, agentTailorRunCreateSchema);

  if (!parsed.ok) {
    return parsed.response;
  }

  const body = parsed.data;
  const resumeId = body.resumeId;
  const jobLeadId = body.jobLeadId;

  const [resume, jobLead] = await Promise.all([
    prisma.resume.findFirst({
      where: { id: resumeId, ownerId: auth.user.id },
      select: { id: true }
    }),
    prisma.jobLead.findFirst({
      where: { id: jobLeadId, ownerId: auth.user.id },
      select: { id: true }
    })
  ]);

  if (!resume || !jobLead) {
    return NextResponse.json({ ok: false, error: "resource_not_found" }, { status: 404 });
  }

  // An agent result is an AI result too: it may only be written against the
  // current confirmed document, and its references must be verifiable.
  let confirmedDocument;
  try {
    confirmedDocument = await loadConfirmedResumeDocument({ userId: auth.user.id, resumeId });
  } catch (error) {
    if (error instanceof ConfirmedResumeDocumentError) {
      return NextResponse.json({ ok: false, error: "confirmed_resume_required" }, { status: 422 });
    }
    return serverError("Failed to load confirmed resume document.");
  }

  if (body.suggestionsJson) {
    const analysis = ResumeAnalysisEnvelopeSchema.safeParse(body.suggestionsJson);
    if (
      !analysis.success ||
      analysis.data.sourceResumeParseId !== confirmedDocument.resumeParseId ||
      !validateResumeAnalysisEvidence(analysis.data.dimensions, confirmedDocument.document)
    ) {
      return NextResponse.json({ ok: false, error: "invalid_resume_analysis" }, { status: 422 });
    }
  }

  const suggestionsJson =
    body.suggestionsJson
      ? JSON.stringify(body.suggestionsJson)
      : JSON.stringify({
          highlights: [],
          keywordGaps: [],
          rewriteIdeas: [],
          draftTitle: body.draftTitle || "",
          draftText: body.draftText || ""
        });

  const run = await createAgentRunLog({
    userId: auth.user.id,
    kind: AgentRunKind.TAILOR_REQUEST,
    source: AgentRunSource.API,
    status: AgentRunStatus.PENDING,
    input: body,
    jobLeadId,
    resumeId
  });

  try {
    const tailorRun = await prisma.resumeTailorRun.create({
      data: {
        resumeId,
        jobLeadId,
        aiProvider: body.provider || "external-agent",
        aiNote: body.aiNote || "Written back by an external agent.",
        summary: body.summary,
        draftTitle: body.draftTitle || null,
        draftText: body.draftText || null,
        suggestionsJson
      }
    });

    await completeAgentRunLog({
      agentRunId: run.id,
      status: AgentRunStatus.SUCCEEDED,
      output: { tailorRunId: tailorRun.id }
    });

    return NextResponse.json({
      ok: true,
      tailorRun: {
        id: tailorRun.id,
        summary: tailorRun.summary
      }
    });
  } catch (error) {
    await completeAgentRunLog({
      agentRunId: run.id,
      status: AgentRunStatus.FAILED,
      errorMessage: error instanceof Error ? error.message : "Failed to write tailor result."
    });
    return serverError("Failed to write tailor result.");
  }
}
