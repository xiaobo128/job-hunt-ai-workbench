import { prisma } from "@/lib/db";
import { ResumeDocumentSchema, type ResumeDocument } from "@/lib/resume-parsing/core";

export type ConfirmedResumeDocument = {
  resumeParseId: string;
  resumeId: string;
  document: ResumeDocument;
};

export class ConfirmedResumeDocumentError extends Error {
  readonly code = "CONFIRMED_RESUME_DOCUMENT_REQUIRED";

  constructor() {
    super("请先完成该简历的结构化确认，再使用简历 AI 功能。");
    this.name = "ConfirmedResumeDocumentError";
  }
}

/** Read-only source of truth for every resume AI request. */
export async function loadConfirmedResumeDocument({ userId, resumeId }: { userId: string; resumeId: string }) {
  const parse = await prisma.resumeParse.findFirst({
    where: {
      resumeId,
      status: "CONFIRMED",
      resume: { id: resumeId, ownerId: userId }
    },
    select: {
      id: true,
      resumeId: true,
      schemaVersion: true,
      documentJson: true,
      resumeAsset: { select: { resumeId: true } }
    }
  });

  if (!parse || parse.resumeId !== resumeId || parse.resumeAsset.resumeId !== resumeId || parse.schemaVersion !== 1) {
    throw new ConfirmedResumeDocumentError();
  }

  const parsedDocument = ResumeDocumentSchema.safeParse(parse.documentJson);
  if (!parsedDocument.success) {
    throw new ConfirmedResumeDocumentError();
  }

  return {
    resumeParseId: parse.id,
    resumeId,
    document: parsedDocument.data
  } satisfies ConfirmedResumeDocument;
}
