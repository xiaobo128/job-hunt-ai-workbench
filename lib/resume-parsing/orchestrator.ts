import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  ResumeDocumentSchema,
  ResumeExtractionProviderError,
  normalizeExtractedResume,
  type ResumeExtractionProvider
} from "@/lib/resume-parsing/core";
import { TextInResumeExtractionProvider } from "@/lib/resume-parsing/textin";
import { readStoredUploadBytes } from "@/lib/uploads";

const SAFE_FAILURES = {
  TEXTIN_CONFIGURATION: "简历解析服务尚未配置。",
  TEXTIN_INVALID_INPUT: "该文件无法用于简历结构化解析。",
  TEXTIN_TIMEOUT: "简历解析请求超时，请稍后重试。",
  TEXTIN_TRANSPORT: "简历解析服务暂时不可用，请稍后重试。",
  TEXTIN_RESPONSE: "简历解析服务返回的数据无效，请稍后重试。",
  TEXTIN_PROVIDER: "简历解析服务未能处理该文件，请稍后重试。",
  ASSET_READ_FAILED: "无法读取已上传的简历文件，请重新上传后重试。",
  NORMALIZATION_FAILED: "简历解析结果无法整理，请稍后重试。",
  PARSE_UNEXPECTED: "简历解析暂时失败，请稍后重试。"
} as const;

type FailureCode = keyof typeof SAFE_FAILURES;

type OrchestrateResumeParseInput = {
  userId: string;
  resumeId: string;
  resumeAssetId: string;
  provider?: ResumeExtractionProvider;
};

export async function orchestrateResumeParse({
  userId,
  resumeId,
  resumeAssetId,
  provider = new TextInResumeExtractionProvider()
}: OrchestrateResumeParseInput) {
  const startedAt = Date.now();
  const asset = await prisma.resumeAsset.findFirst({
    where: {
      id: resumeAssetId,
      resumeId,
      resume: { ownerId: userId }
    },
    select: {
      id: true,
      resumeId: true,
      kind: true,
      fileUrl: true,
      artifactName: true
    }
  });

  if (!asset || (asset.kind !== "PDF" && asset.kind !== "DOCX")) {
    return null;
  }

  const attempt = await prisma.resumeParse.create({
    data: {
      resumeId: asset.resumeId,
      resumeAssetId: asset.id,
      status: "PROCESSING",
      schemaVersion: 1,
      provider: "textin",
      documentJson: Prisma.DbNull,
      qualityJson: Prisma.DbNull,
      providerRequestId: null,
      errorCode: null,
      errorMessage: null,
      confirmedAt: null
    },
    select: { id: true }
  });
  const logContext = {
    resumeId: asset.resumeId,
    resumeAssetId: asset.id,
    parseAttemptId: attempt.id,
    provider: "textin"
  };
  console.info("resume_parse", { ...logContext, stage: "parse_created" });

  try {
    let bytes: Buffer;
    try {
      console.info("resume_parse", { ...logContext, stage: "asset_read_started" });
      bytes = await readStoredUploadBytes(asset.fileUrl);
      console.info("resume_parse", { ...logContext, stage: "asset_read_finished", elapsedMs: Date.now() - startedAt });
    } catch {
      throw new ResumeParseFailure("ASSET_READ_FAILED");
    }

    console.info("resume_parse", { ...logContext, stage: "provider_started", elapsedMs: Date.now() - startedAt });
    const result = await provider.extract({ bytes, fileName: asset.artifactName });
    console.info("resume_parse", { ...logContext, stage: "provider_finished", elapsedMs: Date.now() - startedAt });

    let document;
    try {
      document = normalizeExtractedResume(result.extraction);
      document = ResumeDocumentSchema.parse(document);
      console.info("resume_parse", { ...logContext, stage: "normalization_finished", elapsedMs: Date.now() - startedAt });
    } catch {
      throw new ResumeParseFailure("NORMALIZATION_FAILED");
    }

    const parse = await prisma.resumeParse.update({
      where: { id: attempt.id },
      data: {
        status: "NEEDS_REVIEW",
        documentJson: document as Prisma.InputJsonValue,
        providerRequestId: result.metadata.requestId,
        qualityJson: { warnings: result.extraction.warnings } as Prisma.InputJsonValue,
        errorCode: null,
        errorMessage: null,
        confirmedAt: null
      }
    });
    console.info("resume_parse", { ...logContext, stage: "parse_needs_review", elapsedMs: Date.now() - startedAt });
    return parse;
  } catch (error) {
    const failure = getSafeFailure(error);
    const errorName = error instanceof Error ? error.name : "UnknownError";
    const parse = await prisma.resumeParse.update({
      where: { id: attempt.id },
      data: {
        status: "FAILED",
        documentJson: Prisma.DbNull,
        qualityJson: Prisma.DbNull,
        providerRequestId: null,
        errorCode: failure.code,
        errorMessage: SAFE_FAILURES[failure.code],
        confirmedAt: null
      }
    });
    console.error("resume_parse", {
      ...logContext,
      stage: "parse_failed",
      safeErrorCode: failure.code,
      errorName,
      elapsedMs: Date.now() - startedAt
    });
    return parse;
  }
}

class ResumeParseFailure extends Error {
  constructor(readonly code: FailureCode) {
    super(code);
  }
}

function getSafeFailure(error: unknown): { code: FailureCode } {
  if (error instanceof ResumeParseFailure) {
    return { code: error.code };
  }

  if (error instanceof ResumeExtractionProviderError) {
    return { code: `TEXTIN_${error.code}` as FailureCode };
  }

  return { code: "PARSE_UNEXPECTED" };
}
