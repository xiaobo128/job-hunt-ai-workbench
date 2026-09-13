import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ResumeDocumentSchema } from "@/lib/resume-parsing/core";

export type ResumeParseConfirmationErrorCode =
  | "NOT_FOUND"
  | "INVALID_STATUS"
  | "INVALID_DOCUMENT";

export class ResumeParseConfirmationError extends Error {
  constructor(
    public readonly code: ResumeParseConfirmationErrorCode,
    message: string
  ) {
    super(message);
    this.name = "ResumeParseConfirmationError";
  }
}

export async function confirmResumeParse({ userId, parseId }: { userId: string; parseId: string }) {
  return prisma.$transaction(async (tx) => {
    const initialParse = await tx.resumeParse.findFirst({
      where: {
        id: parseId,
        resume: { ownerId: userId }
      },
      select: {
        resumeId: true
      }
    });

    if (!initialParse) {
      throw new ResumeParseConfirmationError("NOT_FOUND", "未找到可确认的结构化解析记录。");
    }

    // Serialize every confirmation for one Resume before checking or changing statuses.
    const lockedResume = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT "id" FROM "Resume" WHERE "id" = ${initialParse.resumeId} FOR UPDATE`
    );

    if (lockedResume.length !== 1) {
      throw new ResumeParseConfirmationError("NOT_FOUND", "未找到可确认的结构化解析记录。");
    }

    const parse = await tx.resumeParse.findFirst({
      where: {
        id: parseId,
        resumeId: initialParse.resumeId,
        resume: { ownerId: userId }
      },
      select: {
        id: true,
        resumeId: true,
        resumeAssetId: true,
        status: true,
        documentJson: true,
        schemaVersion: true,
        resumeAsset: { select: { resumeId: true } }
      }
    });

    if (!parse || parse.resumeAsset.resumeId !== parse.resumeId) {
      throw new ResumeParseConfirmationError("NOT_FOUND", "未找到可确认的结构化解析记录。");
    }

    if (parse.status !== "NEEDS_REVIEW") {
      throw new ResumeParseConfirmationError("INVALID_STATUS", "该解析记录当前不能确认，请刷新页面后重试。");
    }

    if (parse.schemaVersion !== 1 || !ResumeDocumentSchema.safeParse(parse.documentJson).success) {
      throw new ResumeParseConfirmationError("INVALID_DOCUMENT", "结构化简历数据无效，请先完成审核并保存。");
    }

    const confirmedAt = new Date();

    await tx.resumeParse.updateMany({
      where: {
        resumeId: parse.resumeId,
        status: "CONFIRMED",
        id: { not: parse.id }
      },
      data: { status: "SUPERSEDED" }
    });

    const confirmed = await tx.resumeParse.updateMany({
      where: {
        id: parse.id,
        resumeId: parse.resumeId,
        status: "NEEDS_REVIEW"
      },
      data: {
        status: "CONFIRMED",
        confirmedAt
      }
    });

    if (confirmed.count !== 1) {
      throw new ResumeParseConfirmationError("INVALID_STATUS", "该解析记录当前不能确认，请刷新页面后重试。");
    }

    return {
      parseId: parse.id,
      resumeId: parse.resumeId,
      confirmedAt
    };
  });
}
