"use server";

import path from "path";
import { readFile, writeFile } from "fs/promises";
import {
  AgentRunKind,
  ApplicationStage,
  EventStatus,
  EventType,
  Prisma,
  ResumeAssetKind,
  ResumeVariantSourceType,
  SourceType
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  createResumeAnalysis,
  extractJobTextFromImage,
  extractResumeTextFromImage,
  ResumeAnalysisGenerationError,
  reviseResumeDraft,
  tailorResume
} from "@/lib/ai";
import { buildDocxBuffer } from "../lib/docx-export";
import { buildPdfBuffer } from "../lib/pdf-export";
import { multilineToJson, safeJsonArray } from "@/lib/format";
import { parseJobLeadDebug } from "@/lib/job-lead-ai";
import {
  chooseResumeAssetSources,
  detectResumeAssetKind,
  evaluateResumeAssetMatchStatus,
  resolveResumeText
} from "@/lib/resume-assets";
import { INITIAL_RESUME_LINK_VARIANT_NOTE } from "@/lib/resume-linking";
import { extractStoredUploadText, isExtractionPlaceholder, persistUpload } from "@/lib/uploads";
import { orchestrateResumeParse } from "@/lib/resume-parsing/orchestrator";
import { ResumeDocumentSchema } from "@/lib/resume-parsing/core";
import { confirmResumeParse, ResumeParseConfirmationError } from "@/lib/resume-parsing/confirmation";
import { loadConfirmedResumeDocument } from "@/lib/resume-parsing/confirmed";
import { formatResumeDocument } from "@/lib/resume-analysis";
import { requireSessionUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { saveUpload } from "@/lib/storage";
import { generateApiTokenValue, sha256 } from "@/lib/agent-auth";
import { triggerOutboundWebhook } from "@/lib/agent-webhooks";

async function updateEnvVariable(variable: string, value: string) {
  const envPath = path.join(process.cwd(), ".env.local");
  let content = "";

  try {
    content = await readFile(envPath, "utf8");
  } catch {
    content = "";
  }

  const lines = content ? content.split(/\r?\n/) : [];
  const nextLines: string[] = [];
  let replaced = false;

  for (const line of lines) {
    if (line.startsWith(`${variable}=`)) {
      replaced = true;

      if (value) {
        nextLines.push(`${variable}=${value}`);
      }

      continue;
    }

    nextLines.push(line);
  }

  if (!replaced && value) {
    nextLines.push(`${variable}=${value}`);
  }

  await writeFile(envPath, `${nextLines.filter(Boolean).join("\n")}\n`, "utf8");
}

function getUserAiSettings(user: {
  aiProvider?: string | null;
  aiApiKey?: string | null;
  aiApiBaseUrl?: string | null;
  aiForwardHost?: string | null;
  aiModel?: string | null;
  aiVisionModel?: string | null;
}) {
  return {
    provider: user.aiProvider,
    apiKey: user.aiApiKey,
    apiBaseUrl: user.aiApiBaseUrl,
    forwardHost: user.aiForwardHost,
    model: user.aiModel,
    visionModel: user.aiVisionModel
  };
}

async function getPersistedUserAiSettings(userId: string) {
  const freshUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      aiProvider: true,
      aiApiKey: true,
      aiApiBaseUrl: true,
      aiForwardHost: true,
      aiModel: true,
      aiVisionModel: true
    }
  });

  return getUserAiSettings(freshUser || {});
}

async function requireConfirmedResumeForTailor(userId: string, resumeId: string) {
  try {
    return await loadConfirmedResumeDocument({ userId, resumeId });
  } catch {
    redirect("/tailor?tailorError=confirmed_resume_required");
  }
}

function getSafeErrorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  return "UNEXPECTED_PERSISTENCE_ERROR";
}

export async function createJobLead(formData: FormData) {
  const user = await requireSessionUser();
  const aiSettings = await getPersistedUserAiSettings(user.id);
  const files = formData
    .getAll("artifact")
    .filter((value): value is File => value instanceof File && value.size > 0);
  const uploadedFiles = await Promise.all(files.map((file) => persistUpload(file, "job-leads")));
  const uploaded = uploadedFiles[0] ?? null;
  const artifactNames = uploadedFiles.map((item) => item?.originalName).filter((value): value is string => Boolean(value));
  const artifactUrls = uploadedFiles.map((item) => item?.fileUrl).filter((value): value is string => Boolean(value));
  const manualRoleTitle = ((formData.get("manualRoleTitle") as string | null) ?? "").trim();
  const sourceName = (formData.get("sourceName") as string | null) ?? undefined;
  const sourceUrl = (formData.get("sourceUrl") as string | null) ?? undefined;
  const sourceType = (
    uploadedFiles.some((item) => item?.mimeType.startsWith("image/"))
      ? "SCREENSHOT"
      : ((formData.get("sourceType") as keyof typeof SourceType | null) ?? "TEXT")
  ) as keyof typeof SourceType;
  const rawText = (formData.get("rawContent") as string | null)?.trim() ?? "";
  let imageExtractedText = "";
  const imageOcrNotes: string[] = [];

  if (sourceType === "SCREENSHOT" && !rawText) {
    const imageUploads = uploadedFiles.filter((item): item is NonNullable<typeof item> => Boolean(item && item.mimeType.startsWith("image/")));
    const imageResults = await Promise.all(
      imageUploads.map((item) =>
        extractJobTextFromImage({
          imagePath: item.absolutePath,
          imageMimeType: item.mimeType,
          fileName: item.originalName,
          settings: aiSettings
        })
      )
    );

    imageExtractedText = imageResults
      .map((result) => result.data.extractedText.trim())
      .filter(Boolean)
      .join("\n\n");
    imageOcrNotes.push(...imageResults.map((result) => result.note).filter(Boolean));
  }

  const linkMemo = [sourceUrl?.trim() ? `参考链接：${sourceUrl.trim()}` : "", sourceName?.trim() ? `来源备注：${sourceName.trim()}` : ""]
    .filter(Boolean)
    .join("\n");
  const screenshotFallback =
    sourceType === "SCREENSHOT" && uploadedFiles.length > 0
      ? `已上传 ${uploadedFiles.length} 张岗位截图，当前还没有提取到正文，请稍后补充关键岗位信息。`
      : "";
  const contentSeed =
    rawText ||
    imageExtractedText ||
    (uploaded?.mimeType.startsWith("image/") ? "" : uploaded?.extractedText) ||
    screenshotFallback ||
    linkMemo;
  const rawContent = [manualRoleTitle ? `岗位名称：${manualRoleTitle}` : "", contentSeed].filter(Boolean).join("\n");

  if (!rawContent) {
    return;
  }

  const parsedResult = await parseJobLeadDebug({
    sourceType,
    sourceName: sourceName || uploaded?.originalName,
    sourceUrl,
    rawContent,
    imagePath: uploaded?.mimeType.startsWith("image/") ? uploaded.absolutePath : undefined,
    imageMimeType: uploaded?.mimeType.startsWith("image/") ? uploaded.mimeType : undefined,
    settings: aiSettings
  });
  const parsed = parsedResult.data;
  const roleTitle = manualRoleTitle || parsed.roleTitle;
  const parseNote = [...imageOcrNotes, parsedResult.note].filter(Boolean).join(" ");

  const created = await prisma.jobLead.create({
    data: {
      ownerId: user.id,
      parseProvider: parsedResult.provider,
      parseNote,
      needsReview: true,
      sourceType: parsed.sourceType,
      sourceName: parsed.sourceName,
      sourceUrl: parsed.sourceUrl,
      artifactName: uploaded?.originalName,
      artifactUrl: uploaded?.fileUrl,
      artifactNamesJson: artifactNames.length > 0 ? JSON.stringify(artifactNames) : null,
      artifactUrlsJson: artifactUrls.length > 0 ? JSON.stringify(artifactUrls) : null,
      companyName: parsed.companyName,
      roleTitle,
      city: parsed.city,
      seniority: parsed.seniority,
      salaryRange: parsed.salaryRange,
      skills: JSON.stringify(parsed.skills),
      responsibilities: JSON.stringify(parsed.responsibilities),
      requirements: JSON.stringify(parsed.requirements),
      rawContent: parsed.rawContent,
      parsedSummary: parsed.parsedSummary,
      status: ApplicationStage.READY_TO_APPLY,
      application: {
        create: {
          currentStage: ApplicationStage.READY_TO_APPLY,
          submissionChannel: sourceName?.trim() || null
        }
      }
    }
  });

  revalidatePath("/");
  revalidatePath("/jobs");
  revalidatePath("/board");
  redirect(`/jobs/${created.id}?review=1`);
}

export async function updateJobLead(formData: FormData) {
  const jobLeadId = formData.get("jobLeadId") as string;
  const user = await requireSessionUser();
  const redirectTo = ((formData.get("redirectTo") as string | null) ?? "").trim() || "/jobs";

  await prisma.jobLead.updateMany({
    where: { id: jobLeadId, ownerId: user.id },
    data: {
      needsReview: false,
      reviewedAt: new Date(),
      sourceName: ((formData.get("sourceName") as string | null) ?? "").trim() || null,
      sourceUrl: ((formData.get("sourceUrl") as string | null) ?? "").trim() || null,
      companyName: ((formData.get("companyName") as string | null) ?? "").trim() || "待确认公司",
      roleTitle: ((formData.get("roleTitle") as string | null) ?? "").trim() || "待确认岗位",
      city: ((formData.get("city") as string | null) ?? "").trim() || null,
      seniority: ((formData.get("seniority") as string | null) ?? "").trim() || null,
      salaryRange: ((formData.get("salaryRange") as string | null) ?? "").trim() || null,
      responsibilities: multilineToJson((formData.get("responsibilitiesText") as string | null) ?? ""),
      requirements: multilineToJson((formData.get("requirementsText") as string | null) ?? ""),
      parseNote: ((formData.get("parseNote") as string | null) ?? "").trim() || null
    }
  });

  revalidatePath("/");
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobLeadId}`);
  redirect(redirectTo);
}

export async function confirmJobLeadReview(formData: FormData) {
  const user = await requireSessionUser();
  const jobLeadId = formData.get("jobLeadId") as string;

  await prisma.jobLead.updateMany({
    where: { id: jobLeadId, ownerId: user.id },
    data: {
      needsReview: false,
      reviewedAt: new Date()
    }
  });

  revalidatePath("/");
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobLeadId}`);
}

export async function updateApplicationStage(formData: FormData) {
  const user = await requireSessionUser();
  const applicationId = formData.get("applicationId") as string;
  const stage = formData.get("stage") as ApplicationStage;
  const nextAction = formData.has("nextAction")
    ? (((formData.get("nextAction") as string | null) ?? "").trim() || null)
    : undefined;
  const submissionChannel = formData.has("submissionChannel")
    ? (((formData.get("submissionChannel") as string | null) ?? "").trim() || null)
    : undefined;
  const note = (formData.get("note") as string | null) ?? undefined;

  const application = await prisma.application.findFirst({
    where: { id: applicationId, jobLead: { ownerId: user.id } }
  });

  if (!application) {
    throw new Error("Application not found");
  }

  await prisma.application.update({
    where: { id: applicationId },
    data: {
      currentStage: stage,
      submissionChannel,
      nextAction,
      note,
      appliedAt: stage === ApplicationStage.APPLIED && application.currentStage !== ApplicationStage.APPLIED ? new Date() : undefined
    }
  });

  await prisma.jobLead.update({
    where: { id: application.jobLeadId },
    data: {
      status: stage
    }
  });

  revalidatePath("/");
  revalidatePath("/jobs");
  revalidatePath("/board");
  revalidatePath(`/jobs/${application.jobLeadId}`);

}

export async function updateEventStatus(eventId: string, status: EventStatus) {
  const user = await requireSessionUser();

  if (!eventId || !Object.values(EventStatus).includes(status)) {
    throw new Error("Invalid event status");
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId, application: { jobLead: { ownerId: user.id } } },
    select: { id: true, applicationId: true, application: { select: { jobLeadId: true } } }
  });

  if (!event) {
    throw new Error("Event not found");
  }

  await prisma.event.update({ where: { id: event.id }, data: { status } });

  revalidatePath("/");
  revalidatePath("/notifications");
  revalidatePath(`/notifications/${event.applicationId}`);
  revalidatePath(`/jobs/${event.application.jobLeadId}`);
}

export async function closeDashboardApplication(applicationId: string) {
  const formData = new FormData();
  formData.set("applicationId", applicationId);
  formData.set("stage", ApplicationStage.CLOSED);
  await updateApplicationStage(formData);
}

export async function createResume(formData: FormData) {
  const user = await requireSessionUser();
  const aiSettings = await getPersistedUserAiSettings(user.id);
  const files = formData
    .getAll("resumeFiles")
    .filter((value): value is File => value instanceof File && value.size > 0);
  const fallbackFile = formData.get("resumeFile");
  if (files.length === 0 && fallbackFile instanceof File && fallbackFile.size > 0) {
    files.push(fallbackFile);
  }
  const uploadedFiles = await Promise.all(
    files.map((file) =>
      persistUpload(file, "resumes", {
        settings: aiSettings,
        extractText: shouldUseTextInResumeParsing(file.name, file.type) ? false : undefined
      })
    )
  );
  const uploadedAssets = uploadedFiles.filter((item): item is NonNullable<typeof item> => Boolean(item));
  const title =
    ((formData.get("title") as string | null) ?? "").trim() ||
    uploadedAssets[0]?.originalName.replace(/\.[^.]+$/, "") ||
    "";
  const note = ((formData.get("note") as string | null) ?? "").trim();

  if (!title || uploadedAssets.length === 0) {
    return;
  }

  const assetDrafts = uploadedAssets.map((asset, index) => ({
    originalName: asset.originalName,
    mimeType: asset.mimeType,
    fileUrl: asset.fileUrl,
    extractedText: isExtractionPlaceholder(asset.extractedText) ? "" : asset.extractedText,
    kind: detectResumeAssetKind(asset.originalName, asset.mimeType),
    order: index
  }));
  const sources = chooseResumeAssetSources(
    assetDrafts.map((asset) => ({
      id: `${asset.order}`,
      kind: asset.kind,
      artifactName: asset.originalName,
      artifactMimeType: asset.mimeType,
      extractedText: asset.extractedText,
      isEditingSource: false,
      isPreviewSource: false
    }))
  );
  const previewKey = sources.previewSource?.id || null;
  const editingKey = sources.editingSource?.id || null;
  const primaryAsset = assetDrafts.find((asset) => `${asset.order}` === previewKey) || assetDrafts[0];
  const preferredTextAsset = assetDrafts.find((asset) => `${asset.order}` === editingKey && asset.extractedText.trim()) || null;

  const created = await prisma.resume.create({
    data: {
      ownerId: user.id,
      title,
      rawText: preferredTextAsset?.extractedText || null,
      note: note || null,
      fileUrl: primaryAsset.fileUrl,
      artifactName: primaryAsset.originalName,
      artifactMimeType: primaryAsset.mimeType,
      assets: {
        create: assetDrafts.map((asset) => ({
          kind: asset.kind,
          fileUrl: asset.fileUrl,
          artifactName: asset.originalName,
          artifactMimeType: asset.mimeType,
          extractedText: asset.extractedText || null,
          isPreviewSource: `${asset.order}` === previewKey,
          isEditingSource: `${asset.order}` === editingKey
        }))
      }
    },
    include: {
      assets: true
    }
  });

  await syncResumeAssetMetadata(created.id, aiSettings, { refreshText: false });

  const parseAsset = chooseAutomaticParseAsset(created.assets);
  if (parseAsset) {
    await orchestrateResumeParse({
      userId: user.id,
      resumeId: created.id,
      resumeAssetId: parseAsset.id
    });
  }

  revalidatePath("/resumes");
  revalidatePath("/tailor");
  redirect("/resumes");
}

export async function createResumeAssets(formData: FormData) {
  const user = await requireSessionUser();
  const aiSettings = await getPersistedUserAiSettings(user.id);
  const resumeId = formData.get("resumeId") as string;
  const files = formData
    .getAll("resumeFiles")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (!resumeId || files.length === 0) {
    return;
  }

  const resume = await prisma.resume.findFirst({
    where: { id: resumeId, ownerId: user.id },
    include: { assets: true }
  });

  if (!resume) {
    return;
  }

  const uploadedFiles = await Promise.all(
    files.map((file) =>
      persistUpload(file, "resumes", {
        settings: aiSettings,
        extractText: shouldUseTextInResumeParsing(file.name, file.type) ? false : undefined
      })
    )
  );
  const uploadedAssets = uploadedFiles.filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (uploadedAssets.length === 0) {
    return;
  }

  await prisma.resumeAsset.createMany({
    data: uploadedAssets.map((asset) => ({
      resumeId: resume.id,
      kind: detectResumeAssetKind(asset.originalName, asset.mimeType),
      fileUrl: asset.fileUrl,
      artifactName: asset.originalName,
      artifactMimeType: asset.mimeType,
      extractedText: isExtractionPlaceholder(asset.extractedText) ? null : asset.extractedText
    }))
  });

  const createdAssets = await prisma.resumeAsset.findMany({
    where: {
      resumeId: resume.id,
      fileUrl: { in: uploadedAssets.map((asset) => asset.fileUrl) }
    }
  });

  await syncResumeAssetMetadata(resume.id, aiSettings, { refreshText: false });

  const parseAsset = chooseAutomaticParseAsset(createdAssets);
  if (parseAsset) {
    await orchestrateResumeParse({
      userId: user.id,
      resumeId: resume.id,
      resumeAssetId: parseAsset.id
    });
  }

  revalidatePath("/resumes");
  revalidatePath("/tailor");
  redirect("/resumes");
}

export async function updateResumeNote(formData: FormData) {
  const user = await requireSessionUser();
  const resumeId = formData.get("resumeId") as string;
  const note = ((formData.get("note") as string | null) ?? "").trim();

  if (!resumeId) {
    return;
  }

  await prisma.resume.updateMany({
    where: {
      id: resumeId,
      ownerId: user.id
    },
    data: {
      note: note || null
    }
  });

  revalidatePath("/resumes");
  revalidatePath("/tailor");
}

export async function updateAiSettings(formData: FormData) {
  const user = await requireSessionUser();
  const clearAiSettings = formData.get("clearAiSettings") === "true";
  const provider = ((formData.get("aiProvider") as string | null) ?? "").trim();
  const apiKey = ((formData.get("aiApiKey") as string | null) ?? "").trim();
  const apiBaseUrl = ((formData.get("aiApiBaseUrl") as string | null) ?? "").trim();
  const forwardHost = ((formData.get("aiForwardHost") as string | null) ?? "").trim();
  const model = ((formData.get("aiModel") as string | null) ?? "").trim();
  const visionModel = ((formData.get("aiVisionModel") as string | null) ?? "").trim();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      aiProvider: clearAiSettings ? null : provider || null,
      aiApiBaseUrl: clearAiSettings ? null : apiBaseUrl || null,
      aiForwardHost: clearAiSettings ? null : forwardHost || null,
      aiModel: clearAiSettings ? null : model || null,
      aiVisionModel: clearAiSettings ? null : visionModel || null,
      ...(clearAiSettings ? { aiApiKey: null } : apiKey ? { aiApiKey: apiKey } : {})
    }
  });

  revalidatePath("/account");
  revalidatePath("/tailor");
  revalidatePath("/jobs");
  revalidatePath("/");
}

export const updateOpenAiApiKey = updateAiSettings;

export async function createApiToken(formData: FormData) {
  const user = await requireSessionUser();
  const name = ((formData.get("name") as string | null) ?? "").trim() || "Default automation token";
  const tokenValue = generateApiTokenValue();

  await prisma.apiToken.create({
    data: {
      userId: user.id,
      name,
      tokenHash: sha256(tokenValue)
    }
  });

  revalidatePath("/account");
  redirect(`/account?createdToken=${encodeURIComponent(tokenValue)}&createdTokenName=${encodeURIComponent(name)}`);
}

export async function revokeApiToken(formData: FormData) {
  const user = await requireSessionUser();
  const tokenId = formData.get("tokenId") as string;

  if (!tokenId) {
    return;
  }

  await prisma.apiToken.updateMany({
    where: {
      id: tokenId,
      userId: user.id,
      revokedAt: null
    },
    data: {
      revokedAt: new Date()
    }
  });

  revalidatePath("/account");
}

export async function updateAgentWebhookSettings(formData: FormData) {
  const user = await requireSessionUser();
  const resumeTailorWebhookUrl = ((formData.get("resumeTailorWebhookUrl") as string | null) ?? "").trim() || null;
  const statusSyncWebhookUrl = ((formData.get("statusSyncWebhookUrl") as string | null) ?? "").trim() || null;
  const notificationWebhookUrl = ((formData.get("notificationWebhookUrl") as string | null) ?? "").trim() || null;
  const webhookSecret = ((formData.get("webhookSecret") as string | null) ?? "").trim() || null;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resumeTailorWebhookUrl,
      statusSyncWebhookUrl,
      notificationWebhookUrl,
      webhookSecret
    }
  });

  revalidatePath("/account");
}

export async function testResumeTailorWebhook() {
  const user = await requireSessionUser();
  const freshUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      webhookSecret: true,
      resumeTailorWebhookUrl: true
    }
  });

  if (!freshUser) {
    return;
  }

  await triggerOutboundWebhook({
    user: {
      id: freshUser.id,
      webhookSecret: freshUser.webhookSecret
    },
    webhookUrl: freshUser.resumeTailorWebhookUrl,
      kind: AgentRunKind.TAILOR_REQUEST,
      input: {
        type: "TAILOR_REQUEST",
        test: true,
        message: "Test webhook from Account Center. Use this to verify external resume-agent connectivity."
      }
  });

  revalidatePath("/account");
}

export async function testStatusSyncWebhook() {
  const user = await requireSessionUser();
  const freshUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      webhookSecret: true,
      statusSyncWebhookUrl: true
    }
  });

  if (!freshUser) {
    return;
  }

  await triggerOutboundWebhook({
    user: {
      id: freshUser.id,
      webhookSecret: freshUser.webhookSecret
    },
    webhookUrl: freshUser.statusSyncWebhookUrl,
      kind: AgentRunKind.STATUS_SYNC,
      input: {
        type: "STATUS_SYNC",
        test: true,
        message: "Test webhook from Account Center. Use this to verify external status-sync connectivity."
      }
  });

  revalidatePath("/account");
}

export async function testNotificationWebhook() {
  const user = await requireSessionUser();
  const freshUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      webhookSecret: true,
      notificationWebhookUrl: true
    }
  });

  if (!freshUser) {
    return;
  }

  await triggerOutboundWebhook({
    user: {
      id: freshUser.id,
      webhookSecret: freshUser.webhookSecret
    },
    webhookUrl: freshUser.notificationWebhookUrl,
      kind: AgentRunKind.NOTIFICATION_IMPORT,
      input: {
        type: "NOTIFICATION_IMPORT",
        test: true,
        message: "Test webhook from Account Center. Use this to verify external notification-sync connectivity."
      }
  });

  revalidatePath("/account");
}

export async function deleteResume(formData: FormData) {
  const user = await requireSessionUser();
  const resumeId = formData.get("resumeId") as string;

  if (!resumeId) {
    return;
  }

  await prisma.resume.deleteMany({
    where: {
      id: resumeId,
      ownerId: user.id
    }
  });

  revalidatePath("/resumes");
  revalidatePath("/tailor");
  revalidatePath("/");
}

export async function deleteResumeAsset(formData: FormData) {
  const user = await requireSessionUser();
  const assetId = formData.get("assetId") as string;

  if (!assetId) {
    return;
  }

  const asset = await prisma.resumeAsset.findFirst({
    where: {
      id: assetId,
      resume: { ownerId: user.id }
    }
  });

  if (!asset) {
    return;
  }

  await prisma.resumeAsset.delete({
    where: { id: asset.id }
  });
  const aiSettings = await getPersistedUserAiSettings(user.id);
  await syncResumeAssetMetadata(asset.resumeId, aiSettings);

  revalidatePath("/resumes");
  revalidatePath("/tailor");
}

export async function retryResumeAssetExtraction(formData: FormData) {
  const user = await requireSessionUser();
  const aiSettings = await getPersistedUserAiSettings(user.id);
  const assetId = formData.get("assetId") as string;

  if (!assetId) {
    return;
  }

  const asset = await prisma.resumeAsset.findFirst({
    where: {
      id: assetId,
      resume: { ownerId: user.id }
    }
  });

  if (!asset) {
    return;
  }

  const extractedText = (
    await extractStoredUploadText({
      fileUrl: asset.fileUrl,
      originalName: asset.artifactName,
      mimeType: asset.artifactMimeType,
      settings: aiSettings
    })
  ).trim();

  await prisma.resumeAsset.update({
    where: { id: asset.id },
    data: {
      extractedText: extractedText || null
    }
  });

  await syncResumeAssetMetadata(asset.resumeId, aiSettings);

  revalidatePath("/resumes");
  revalidatePath("/tailor");
}

export async function retryResumeParse(formData: FormData) {
  const user = await requireSessionUser();
  const failedParseId = formData.get("failedParseId") as string;

  if (!failedParseId) {
    return;
  }

  const failedParse = await prisma.resumeParse.findFirst({
    where: {
      id: failedParseId,
      status: "FAILED",
      resume: { ownerId: user.id }
    },
    select: {
      resumeId: true,
      resumeAssetId: true,
      resumeAsset: { select: { id: true, resumeId: true } }
    }
  });

  if (!failedParse?.resumeAsset || failedParse.resumeAsset.resumeId !== failedParse.resumeId) {
    return;
  }

  await orchestrateResumeParse({
    userId: user.id,
    resumeId: failedParse.resumeId,
    resumeAssetId: failedParse.resumeAssetId
  });

  revalidatePath("/resumes");
}

export type ResumeParseReviewSaveState = {
  error?: string;
  saved?: boolean;
};

export async function saveResumeParseReview(
  _previousState: ResumeParseReviewSaveState,
  formData: FormData
): Promise<ResumeParseReviewSaveState> {
  const user = await requireSessionUser();
  const resumeId = formData.get("resumeId");
  const parseId = formData.get("parseId");
  const documentJson = formData.get("documentJson");

  if (typeof resumeId !== "string" || typeof parseId !== "string" || typeof documentJson !== "string") {
    return { error: "缺少待保存的结构化简历数据。" };
  }

  let document: unknown;
  try {
    document = JSON.parse(documentJson);
  } catch {
    return { error: "结构化简历数据格式无效，请刷新页面后重试。" };
  }

  const validatedDocument = ResumeDocumentSchema.safeParse(document);
  if (!validatedDocument.success) {
    return { error: "结构化字段未通过校验，请补全必填标题和条目内容。" };
  }

  const parse = await prisma.resumeParse.findFirst({
    where: {
      id: parseId,
      resumeId,
      status: "NEEDS_REVIEW",
      resume: { ownerId: user.id }
    },
    select: {
      id: true,
      resumeId: true,
      resumeAssetId: true,
      resumeAsset: { select: { resumeId: true } }
    }
  });

  // Require every hop in Parse -> ResumeAsset -> Resume -> current user to match.
  if (!parse || parse.resumeId !== resumeId || parse.resumeAsset.resumeId !== resumeId) {
    return { error: "未找到可编辑的结构化解析记录。" };
  }

  await prisma.resumeParse.update({
    where: { id: parse.id },
    data: {
      documentJson: validatedDocument.data as Prisma.InputJsonValue,
      // Saving a review draft must never turn it into a confirmed parse.
      status: "NEEDS_REVIEW"
    }
  });

  revalidatePath("/resumes");
  revalidatePath(`/resumes/${resumeId}/parses/${parseId}/review`);
  return { saved: true };
}

export type ResumeParseConfirmState = {
  error?: string;
  confirmed?: boolean;
};

export async function confirmResumeParseReview(
  _previousState: ResumeParseConfirmState,
  formData: FormData
): Promise<ResumeParseConfirmState> {
  const user = await requireSessionUser();
  const parseId = formData.get("parseId");

  if (typeof parseId !== "string" || !parseId) {
    return { error: "缺少待确认的结构化解析记录。" };
  }

  try {
    const confirmed = await confirmResumeParse({ userId: user.id, parseId });
    revalidatePath("/resumes");
    revalidatePath(`/resumes/${confirmed.resumeId}/parses/${confirmed.parseId}/review`);
    return { confirmed: true };
  } catch (error) {
    if (error instanceof ResumeParseConfirmationError) {
      return { error: error.message };
    }

    console.error("Failed to confirm ResumeParse", error);
    return { error: "确认失败，请稍后重试。" };
  }
}

export async function syncResumeEditingSourceText(formData: FormData) {
  const user = await requireSessionUser();
  const aiSettings = await getPersistedUserAiSettings(user.id);
  const resumeId = formData.get("resumeId") as string;

  if (!resumeId) {
    return;
  }

  const resume = await prisma.resume.findFirst({
    where: {
      id: resumeId,
      ownerId: user.id
    },
    select: {
      id: true
    }
  });

  if (!resume) {
    return;
  }

  await syncResumeAssetMetadata(resume.id, aiSettings);

  revalidatePath("/resumes");
  revalidatePath("/tailor");
}

export async function saveDraftAsResume(formData: FormData) {
  const user = await requireSessionUser();
  const tailorRunId = formData.get("tailorRunId") as string;

  const run = await prisma.resumeTailorRun.findFirst({
    where: {
      id: tailorRunId,
      resume: { ownerId: user.id },
      jobLead: { ownerId: user.id }
    },
    include: {
      jobLead: true,
      resume: true
    }
  });

  if (!run || !run.draftText) {
    return;
  }

  const editedDraftTitle = ((formData.get("draftTitle") as string | null) ?? "").trim();
  const editedDraftText = ((formData.get("draftText") as string | null) ?? "").trim();
  const fallbackDraftTitle = buildVariantBaseName(
    getResumeSourceName(run.resume.artifactName, run.resume.title),
    run.jobLead.companyName,
    run.jobLead.roleTitle
  );
  const draftTitle = normalizeDraftTitle(editedDraftTitle || run.draftTitle || "", fallbackDraftTitle);
  const draftText = normalizeDraftBody(editedDraftText || run.draftText);
  const exportFormat = (((formData.get("exportFormat") as string | null) ?? "DOCX").trim().toUpperCase() || "DOCX") as
    | "DOCX"
    | "PDF";

  if (!draftText) {
    return;
  }

  if (editedDraftTitle || editedDraftText) {
    await prisma.resumeTailorRun.update({
      where: { id: run.id },
      data: {
        draftTitle,
        draftText
      }
    });
  }

  const exported = await exportResumeDraftArtifact({
    baseName: draftTitle,
    draftText,
    format: exportFormat
  });
  const existingVariant = await prisma.resumeVariant.findFirst({
    where: {
      resumeId: run.resumeId,
      jobLeadId: run.jobLeadId,
      sourceType: ResumeVariantSourceType.AI_DRAFT
    },
    orderBy: { updatedAt: "desc" }
  });
  const note = existingVariant
    ? `AI 完整草稿已覆盖更新，基于 ${run.resume.title} 针对 ${run.jobLead.companyName} ${run.jobLead.roleTitle} 重新生成。`
    : `AI 完整草稿，基于 ${run.resume.title} 针对 ${run.jobLead.companyName} ${run.jobLead.roleTitle} 生成。`;

  let savedVariantId = "";

  if (existingVariant) {
    const updatedVariant = await prisma.resumeVariant.update({
      where: { id: existingVariant.id },
      data: {
        title: draftTitle,
        draftText,
        tailorRunId: run.id,
        note,
        fileUrl: exported.fileUrl,
        artifactName: exported.originalName,
        artifactMimeType: exported.mimeType
      }
    });
    savedVariantId = updatedVariant.id;
  } else {
    const createdVariant = await prisma.resumeVariant.create({
      data: {
        resumeId: run.resumeId,
        jobLeadId: run.jobLeadId,
        sourceType: ResumeVariantSourceType.AI_DRAFT,
        title: draftTitle,
        draftText,
        tailorRunId: run.id,
        note,
        fileUrl: exported.fileUrl,
        artifactName: exported.originalName,
        artifactMimeType: exported.mimeType
      }
    });
    savedVariantId = createdVariant.id;
  }

  await prisma.resumeTailorRun.delete({
    where: { id: run.id }
  });

  revalidatePath("/resumes");
  revalidatePath("/tailor");
  revalidatePath(`/jobs/${run.jobLeadId}`);
  redirect(`/tailor?downloadVariantId=${savedVariantId}`);
}

export async function createManualResumeVariant(formData: FormData) {
  const user = await requireSessionUser();
  const resumeId = formData.get("resumeId") as string;
  const jobLeadId = ((formData.get("jobLeadId") as string | null) ?? "").trim();
  const file = formData.get("variantFile") as File | null;
  const uploaded = file && file.size > 0 ? await persistUpload(file, "resume-variants", { extractText: false }) : null;
  const title =
    ((formData.get("title") as string | null) ?? "").trim() ||
    uploaded?.originalName.replace(/\.[^.]+$/, "") ||
    "";
  const note = ((formData.get("note") as string | null) ?? "").trim();

  if (!resumeId || !title || !uploaded?.fileUrl) {
    return;
  }

  const [resume, jobLead] = await Promise.all([
    prisma.resume.findFirst({
      where: { id: resumeId, ownerId: user.id },
      select: { id: true, title: true, artifactName: true }
    }),
    jobLeadId ? prisma.jobLead.findFirst({ where: { id: jobLeadId, ownerId: user.id } }) : null
  ]);

  if (!resume) {
    return;
  }

  await prisma.resumeVariant.create({
    data: {
      resumeId: resume.id,
      jobLeadId: jobLead?.id,
      sourceType: ResumeVariantSourceType.MANUAL_UPLOAD,
      title,
      note: note || null,
      fileUrl: uploaded.fileUrl,
      artifactName: uploaded.originalName,
      artifactMimeType: uploaded.mimeType
    }
  });

  revalidatePath("/resumes");
  revalidatePath("/tailor");
  if (jobLead?.id) {
    revalidatePath(`/jobs/${jobLead.id}`);
  }
}

export async function deleteResumeVariant(formData: FormData) {
  const user = await requireSessionUser();
  const variantId = formData.get("variantId") as string;

  if (!variantId) {
    return;
  }

  await prisma.resumeVariant.deleteMany({
    where: {
      id: variantId,
      resume: { ownerId: user.id }
    }
  });

  revalidatePath("/resumes");
  revalidatePath("/tailor");
}

export async function triggerExternalTailor(formData: FormData) {
  const user = await requireSessionUser();
  const resumeId = formData.get("resumeId") as string;
  const jobLeadId = formData.get("jobLeadId") as string;
  const customInstructions = ((formData.get("customInstructions") as string | null) ?? "").trim();

  const [confirmedDocument, resume, jobLead, freshUser] = await Promise.all([
    requireConfirmedResumeForTailor(user.id, resumeId),
    prisma.resume.findFirst({ where: { id: resumeId, ownerId: user.id }, select: { id: true, title: true } }),
    prisma.jobLead.findFirst({
      where: { id: jobLeadId, ownerId: user.id }
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        webhookSecret: true,
        resumeTailorWebhookUrl: true
      }
    })
  ]);

  if (!resume || !jobLead || !freshUser) {
    return;
  }

  await triggerOutboundWebhook({
    user: {
      id: freshUser.id,
      webhookSecret: freshUser.webhookSecret
    },
    webhookUrl: freshUser.resumeTailorWebhookUrl,
    kind: AgentRunKind.TAILOR_REQUEST,
    input: {
      type: "TAILOR_REQUEST",
      job: {
        id: jobLead.id,
        companyName: jobLead.companyName,
        roleTitle: jobLead.roleTitle,
        rawContent: jobLead.rawContent,
        city: jobLead.city,
        sourceName: jobLead.sourceName,
        sourceUrl: jobLead.sourceUrl,
        parsedSummary: jobLead.parsedSummary,
        responsibilities: safeJsonArray(jobLead.responsibilities),
        requirements: safeJsonArray(jobLead.requirements),
        skills: safeJsonArray(jobLead.skills)
      },
      resume: {
        resumeId: resume.id,
        resumeParseId: confirmedDocument.resumeParseId,
        schemaVersion: confirmedDocument.document.schemaVersion,
        document: confirmedDocument.document
      },
      customInstructions
    },
    related: {
      jobLeadId: jobLead.id,
      resumeId: resume.id
    }
  });

  revalidatePath("/tailor");
}

export async function triggerStatusSync(formData: FormData) {
  const user = await requireSessionUser();
  const jobLeadId = formData.get("jobLeadId") as string;

  const [jobLead, freshUser] = await Promise.all([
    prisma.jobLead.findFirst({
      where: { id: jobLeadId, ownerId: user.id },
      include: {
        application: {
          include: {
            events: {
              orderBy: { createdAt: "desc" },
              take: 5
            }
          }
        }
      }
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        webhookSecret: true,
        statusSyncWebhookUrl: true
      }
    })
  ]);

  if (!jobLead || !jobLead.application || !freshUser) {
    return;
  }

  await triggerOutboundWebhook({
    user: {
      id: freshUser.id,
      webhookSecret: freshUser.webhookSecret
    },
    webhookUrl: freshUser.statusSyncWebhookUrl,
    kind: AgentRunKind.STATUS_SYNC,
    input: {
      type: "STATUS_SYNC",
      job: {
        id: jobLead.id,
        companyName: jobLead.companyName,
        roleTitle: jobLead.roleTitle,
        city: jobLead.city,
        sourceName: jobLead.sourceName,
        sourceUrl: jobLead.sourceUrl,
        status: jobLead.status
      },
      application: {
        id: jobLead.application.id,
        currentStage: jobLead.application.currentStage,
        note: jobLead.application.note,
        events: jobLead.application.events.map((event) => ({
          id: event.id,
          eventType: event.eventType,
          title: event.title,
          eventTime: event.eventTime,
          aiProvider: event.aiProvider
        }))
      }
    },
    related: {
      jobLeadId: jobLead.id
    }
  });

  revalidatePath(`/jobs/${jobLead.id}`);
}

export async function triggerNotificationSync(formData: FormData) {
  const user = await requireSessionUser();
  const eventId = formData.get("eventId") as string;

  const [event, freshUser] = await Promise.all([
    prisma.event.findFirst({
      where: {
        id: eventId,
        application: { jobLead: { ownerId: user.id } }
      },
      include: {
        application: {
          include: {
            jobLead: true
          }
        }
      }
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        webhookSecret: true,
        notificationWebhookUrl: true
      }
    })
  ]);

  if (!event || !freshUser) {
    return;
  }

  const details = safeParseEventDetails(event.detailsJson);

  await triggerOutboundWebhook({
    user: {
      id: freshUser.id,
      webhookSecret: freshUser.webhookSecret
    },
    webhookUrl: freshUser.notificationWebhookUrl,
    kind: AgentRunKind.NOTIFICATION_IMPORT,
    input: {
      type: "NOTIFICATION_IMPORT",
      event: {
        id: event.id,
        eventType: event.eventType,
        title: event.title,
        eventTime: event.eventTime,
        artifactName: event.artifactName,
        artifactUrl: event.artifactUrl,
        aiProvider: event.aiProvider,
        aiNote: event.aiNote,
        content: details.content,
        requirements: details.requirements
      },
      application: {
        id: event.application.id,
        currentStage: event.application.currentStage,
        note: event.application.note
      },
      job: {
        id: event.application.jobLead.id,
        companyName: event.application.jobLead.companyName,
        roleTitle: event.application.jobLead.roleTitle,
        city: event.application.jobLead.city,
        sourceName: event.application.jobLead.sourceName,
        sourceUrl: event.application.jobLead.sourceUrl,
        status: event.application.jobLead.status
      }
    },
    related: {
      jobLeadId: event.application.jobLead.id,
      eventId: event.id
    }
  });

  revalidatePath("/notifications");
  revalidatePath(`/jobs/${event.application.jobLead.id}`);
}

export async function updateTailorDraft(formData: FormData) {
  const user = await requireSessionUser();
  const tailorRunId = formData.get("tailorRunId") as string;
  const draftTitle = ((formData.get("draftTitle") as string | null) ?? "").trim();
  const draftText = ((formData.get("draftText") as string | null) ?? "").trim();

  if (!tailorRunId || !draftText) {
    return;
  }

  const run = await prisma.resumeTailorRun.findFirst({
    where: {
      id: tailorRunId,
      resume: { ownerId: user.id },
      jobLead: { ownerId: user.id }
    }
  });

  if (!run) {
    return;
  }

  await prisma.resumeTailorRun.update({
    where: { id: run.id },
    data: {
      draftTitle: draftTitle || run.draftTitle,
      draftText
    }
  });

  revalidatePath("/tailor");
  revalidatePath(`/jobs/${run.jobLeadId}`);
}

export async function deleteTailorRun(formData: FormData) {
  const user = await requireSessionUser();
  const tailorRunId = formData.get("tailorRunId") as string;

  if (!tailorRunId) {
    return;
  }

  const run = await prisma.resumeTailorRun.findFirst({
    where: {
      id: tailorRunId,
      resume: { ownerId: user.id },
      jobLead: { ownerId: user.id }
    }
  });

  if (!run) {
    return;
  }

  await prisma.resumeTailorRun.delete({
    where: { id: run.id }
  });

  revalidatePath("/tailor");
  revalidatePath("/resumes");
  revalidatePath(`/jobs/${run.jobLeadId}`);
}

export async function deleteJobLead(formData: FormData) {
  const user = await requireSessionUser();
  const jobLeadId = formData.get("jobLeadId") as string;

  if (!jobLeadId) {
    return { deleted: false };
  }

  const result = await prisma.jobLead.deleteMany({
    where: {
      id: jobLeadId,
      ownerId: user.id
    }
  });

  revalidatePath("/");
  revalidatePath("/jobs");
  revalidatePath("/board");
  revalidatePath(`/jobs/${jobLeadId}`);

  return { deleted: result.count > 0 };
}

export async function updateBoardJobLead(formData: FormData) {
  const user = await requireSessionUser();
  const jobLeadId = formData.get("jobLeadId") as string;

  if (!jobLeadId) {
    return;
  }

  await prisma.jobLead.updateMany({
    where: { id: jobLeadId, ownerId: user.id },
    data: {
      companyName: ((formData.get("companyName") as string | null) ?? "").trim() || "待确认公司",
      roleTitle: ((formData.get("roleTitle") as string | null) ?? "").trim() || "待确认岗位",
      city: ((formData.get("city") as string | null) ?? "").trim() || null
    }
  });

  revalidatePath("/");
  revalidatePath("/jobs");
  revalidatePath("/board");
  revalidatePath(`/jobs/${jobLeadId}`);
}

export async function updateJobLinkedResumeVariant(formData: FormData) {
  const user = await requireSessionUser();
  const jobLeadId = (formData.get("jobLeadId") as string | null)?.trim() || "";
  const linkedResumeOptionId = (formData.get("linkedResumeOptionId") as string | null)?.trim() || "";

  if (!jobLeadId) {
    return;
  }

  if (!linkedResumeOptionId) {
    return;
  }

  await prisma.resumeVariant.updateMany({
    where: {
      jobLeadId,
      resume: { ownerId: user.id }
    },
    data: {
      jobLeadId: null
    }
  });

  if (linkedResumeOptionId.startsWith("variant:")) {
    const linkedResumeVariantId = linkedResumeOptionId.replace(/^variant:/u, "").trim();

    if (!linkedResumeVariantId) {
      return;
    }

    const variant = await prisma.resumeVariant.findFirst({
      where: {
        id: linkedResumeVariantId,
        resume: { ownerId: user.id },
        OR: [{ jobLeadId: null }, { jobLeadId }]
      },
      select: { id: true }
    });

    if (!variant) {
      return;
    }

    await prisma.resumeVariant.update({
      where: { id: variant.id },
      data: {
        jobLeadId
      }
    });
  } else if (linkedResumeOptionId.startsWith("resume:")) {
    const linkedResumeId = linkedResumeOptionId.replace(/^resume:/u, "").trim();

    if (!linkedResumeId) {
      return;
    }

    const resume = await prisma.resume.findFirst({
      where: {
        id: linkedResumeId,
        ownerId: user.id
      },
      select: {
        id: true,
        title: true,
        fileUrl: true,
        artifactName: true,
        artifactMimeType: true
      }
    });

    if (!resume) {
      return;
    }

    const existingProxyVariant = await prisma.resumeVariant.findFirst({
      where: {
        resumeId: resume.id,
        sourceType: ResumeVariantSourceType.MANUAL_UPLOAD,
        note: INITIAL_RESUME_LINK_VARIANT_NOTE,
        OR: [{ jobLeadId: null }, { jobLeadId }]
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true }
    });

    if (existingProxyVariant) {
      await prisma.resumeVariant.update({
        where: { id: existingProxyVariant.id },
        data: {
          jobLeadId,
          title: resume.title,
          fileUrl: resume.fileUrl,
          artifactName: resume.artifactName,
          artifactMimeType: resume.artifactMimeType
        }
      });
    } else {
      await prisma.resumeVariant.create({
        data: {
          resumeId: resume.id,
          jobLeadId,
          sourceType: ResumeVariantSourceType.MANUAL_UPLOAD,
          title: resume.title,
          note: INITIAL_RESUME_LINK_VARIANT_NOTE,
          fileUrl: resume.fileUrl,
          artifactName: resume.artifactName,
          artifactMimeType: resume.artifactMimeType
        }
      });
    }
  }

  revalidatePath("/jobs");
  revalidatePath("/board");
  revalidatePath("/resumes");
  revalidatePath(`/jobs/${jobLeadId}`);
}

async function createTailorRunInternal(formData: FormData, mode: "advice" | "draft") {
  const user = await requireSessionUser();
  const aiSettings = await getPersistedUserAiSettings(user.id);
  const resumeId = formData.get("resumeId") as string;
  const jobLeadId = formData.get("jobLeadId") as string;
  const customInstructions = ((formData.get("customInstructions") as string | null) ?? "").trim();

  const [confirmedDocument, resume, jobLead] = await Promise.all([
    requireConfirmedResumeForTailor(user.id, resumeId),
    prisma.resume.findFirst({ where: { id: resumeId, ownerId: user.id } }),
    prisma.jobLead.findFirst({ where: { id: jobLeadId, ownerId: user.id } })
  ]);

  if (!resume || !jobLead) {
    return;
  }

  if (mode === "advice") {
    let analysis;
    try {
      analysis = await createResumeAnalysis({
        document: confirmedDocument.document,
        companyName: jobLead.companyName,
        roleTitle: jobLead.roleTitle,
        rawContent: jobLead.rawContent,
        parsedSummary: jobLead.parsedSummary,
        responsibilities: safeJsonArray(jobLead.responsibilities),
        requirements: safeJsonArray(jobLead.requirements),
        skills: safeJsonArray(jobLead.skills),
        customInstructions,
        settings: aiSettings
      });
    } catch (error) {
      if (error instanceof ResumeAnalysisGenerationError) {
        console.error(
          JSON.stringify({
            event: "tailor.resume_analysis_failed",
            failureStage: error.stage,
            errorType: error.name,
            errorCode: error.code,
            zodIssues: error.diagnostics?.issues,
            evidenceFailure: error.diagnostics?.evidence,
            provider: error.diagnostics?.provider,
            resumeId,
            parseId: confirmedDocument.resumeParseId,
            tailorTargetId: jobLeadId
          })
        );
      } else {
        console.error(
          JSON.stringify({
            event: "tailor.resume_analysis_failed",
            failureStage: "action",
            errorType: error instanceof Error ? error.name : "UnknownError",
            errorCode: "UNEXPECTED_ACTION_ERROR",
            resumeId,
            parseId: confirmedDocument.resumeParseId,
            tailorTargetId: jobLeadId
          })
        );
      }
      redirect("/tailor?tailorError=resume_analysis_failed");
    }
    let createdRun;
    try {
      createdRun = await prisma.resumeTailorRun.create({
        data: {
          resumeId,
          jobLeadId,
          aiProvider: analysis.provider,
          aiNote: analysis.note,
          summary: "已生成固定七维简历分析。",
          suggestionsJson: JSON.stringify({
            kind: "resume_analysis",
            analysisSchemaVersion: 1,
            sourceResumeParseId: confirmedDocument.resumeParseId,
            dimensions: analysis.data
          })
        }
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "tailor.resume_analysis_failed",
          failureStage: "persistence",
          errorType: error instanceof Error ? error.name : "UnknownError",
          errorCode: getSafeErrorCode(error),
          resumeId,
          parseId: confirmedDocument.resumeParseId,
          tailorTargetId: jobLeadId
        })
      );
      redirect("/tailor?tailorError=resume_analysis_failed");
    }
    revalidatePath("/tailor");
    revalidatePath(`/jobs/${jobLeadId}`);
    redirect(`/tailor?run=${createdRun.id}&ts=${Date.now()}&mode=${mode}`);
  }

  const result = await tailorResume({
    mode: "draft",
    jobTitle: jobLead.roleTitle,
    companyName: jobLead.companyName,
    resumeText: formatResumeDocument(confirmedDocument.document),
    jobSummary: jobLead.parsedSummary ?? "",
    skills: safeJsonArray(jobLead.skills),
    requirements: safeJsonArray(jobLead.requirements),
    customInstructions,
    settings: aiSettings
  });

  const draftData = result.data as { summary: string; draftTitle?: string; draftText?: string };
  const draftTitle = draftData.draftTitle || "";
  const draftText = draftData.draftText || "";

  const createdRun = await prisma.resumeTailorRun.create({
    data: {
      resumeId,
      jobLeadId,
      aiProvider: result.provider,
      aiNote: result.note,
      summary: result.data.summary,
      draftTitle: draftText
        ? normalizeDraftTitle(
            draftTitle,
            buildVariantBaseName(
              getResumeSourceName(resume.artifactName, resume.title),
              jobLead.companyName,
              jobLead.roleTitle
            )
          )
        : null,
      draftText: draftText ? normalizeDraftBody(draftText) : null,
      suggestionsJson: JSON.stringify({ ...result.data, sourceResumeParseId: confirmedDocument.resumeParseId })
    }
  });

  revalidatePath("/tailor");
  revalidatePath(`/jobs/${jobLeadId}`);
  revalidatePath("/resumes");
  redirect(`/tailor?run=${createdRun.id}&ts=${Date.now()}&mode=${mode}`);
}

async function syncResumeAssetMetadata(
  resumeId: string,
  aiSettings?: Awaited<ReturnType<typeof getPersistedUserAiSettings>>,
  options: { refreshText?: boolean } = {}
) {
  const refreshText = options.refreshText ?? true;
  const resume = await prisma.resume.findUnique({
    where: { id: resumeId },
    include: { assets: true }
  });

  if (!resume) {
    return;
  }

  const assetsWithText = await Promise.all(
    resume.assets.map(async (asset) => {
      const shouldRefreshAsset = refreshText && shouldRefreshResumeAssetText(asset.kind);

      if (!shouldRefreshAsset && (!refreshText || (asset.extractedText?.trim() && !isExtractionPlaceholder(asset.extractedText)))) {
        return asset;
      }

      const extractedText = (
        await extractStoredUploadText({
          fileUrl: asset.fileUrl,
          originalName: asset.artifactName,
          mimeType: asset.artifactMimeType,
          settings: aiSettings
        })
      ).trim();

      if (extractedText && extractedText !== (asset.extractedText || "")) {
        await prisma.resumeAsset.update({
          where: { id: asset.id },
          data: { extractedText }
        });
      }

      return {
        ...asset,
        extractedText: extractedText || asset.extractedText
      };
    })
  );

  const { editingSource, previewSource } = chooseResumeAssetSources(assetsWithText);
  const matchStatuses = evaluateResumeAssetMatchStatus(assetsWithText);

  await Promise.all(
    assetsWithText.map((asset) =>
      prisma.resumeAsset.update({
        where: { id: asset.id },
        data: {
          isEditingSource: asset.id === editingSource?.id,
          isPreviewSource: asset.id === previewSource?.id,
          matchStatus: matchStatuses.get(asset.id) || "UNCHECKED"
        }
      })
    )
  );

  const nextPrimaryAsset = previewSource || editingSource || assetsWithText[0] || null;
  const nextRawText = resolveResumeText({
    rawText: "",
    assets: assetsWithText
  }).text || null;

  await prisma.resume.update({
    where: { id: resume.id },
    data: {
      fileUrl: nextPrimaryAsset?.fileUrl || resume.fileUrl,
      artifactName: nextPrimaryAsset?.artifactName || resume.artifactName,
      artifactMimeType: nextPrimaryAsset?.artifactMimeType || resume.artifactMimeType,
      ...(refreshText ? { rawText: nextRawText || null } : {})
    }
  });
}

function shouldRefreshResumeAssetText(kind: string) {
  return kind === "DOCX" || kind === "DOC" || kind === "TEXT";
}

function shouldUseTextInResumeParsing(fileName: string, mimeType?: string | null) {
  const kind = detectResumeAssetKind(fileName, mimeType);
  return kind === "PDF" || kind === "DOCX";
}

function chooseAutomaticParseAsset<T extends { kind: ResumeAssetKind }>(assets: T[]) {
  return assets.find((asset) => asset.kind === "DOCX") || assets.find((asset) => asset.kind === "PDF") || null;
}

async function exportResumeDraftArtifact({
  baseName,
  draftText,
  format
}: {
  baseName: string;
  draftText: string;
  format: "DOCX" | "PDF";
}) {
  const safeBaseName = sanitizeFileName(baseName);

  if (format === "DOCX") {
    const { buffer, mimeType } = buildDocxBuffer({
      title: safeBaseName,
      body: draftText
    });
    const originalName = `${safeBaseName}.docx`;
    const stored = await saveUpload({
      bytes: buffer,
      originalName,
      folder: "resume-variants",
      contentType: mimeType
    });

    return {
      fileUrl: stored.fileUrl,
      mimeType,
      originalName
    };
  }

  if (format === "PDF") {
    const { buffer, mimeType } = buildPdfBuffer({
      title: safeBaseName,
      body: draftText
    });
    const originalName = `${safeBaseName}.pdf`;
    const stored = await saveUpload({
      bytes: buffer,
      originalName,
      folder: "resume-variants",
      contentType: mimeType
    });

    return {
      fileUrl: stored.fileUrl,
      mimeType,
      originalName
    };
  }

  throw new Error(`Unsupported export format: ${format}`);
}

function buildVariantBaseName(sourceName: string, companyName: string, roleTitle: string) {
  return `${sourceName}-${companyName}-${roleTitle}`;
}

function getResumeSourceName(artifactName: string | null | undefined, resumeTitle: string) {
  const rawName = (artifactName || resumeTitle || "").trim();

  if (!rawName) {
    return "定制简历";
  }

  return rawName.replace(/\.[^.]+$/u, "").trim() || rawName;
}

function normalizeDraftTitle(value: string, fallback: string) {
  const cleaned = value
    .replace(/定制简历/gi, "")
    .replace(/简历草稿/gi, "")
    .replace(/草稿/gi, "")
    .replace(/[|｜\-–—_]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || fallback;
}

function normalizeDraftBody(value: string) {
  const lines = value.split(/\r?\n/);
  const nonEmptyLines = lines.filter((line) => line.trim());

  if (nonEmptyLines.length === 0) {
    return value.trim();
  }

  const bulletLines = nonEmptyLines.filter((line) => /^\s*[-*•]+\s+/u.test(line)).length;
  const shouldCleanUniformBullets = bulletLines / nonEmptyLines.length >= 0.7;

  return lines
    .map((line) => (shouldCleanUniformBullets ? line.replace(/^\s*[-*•]+\s*/u, "") : line))
    .join("\n")
    .trim();
}

function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim() || "定制简历";
}

function mapEventTypeToStage(eventType: EventType) {
  return eventType === "INTERVIEW"
    ? ApplicationStage.FIRST_INTERVIEW
    : eventType === "ASSESSMENT"
      ? ApplicationStage.ASSESSMENT
      : eventType === "OFFER"
        ? ApplicationStage.OFFER
        : eventType === "REJECTION"
          ? ApplicationStage.CLOSED
          : undefined;
}

function safeParseEventDetails(detailsJson: string) {
  try {
    const parsed = JSON.parse(detailsJson) as { content?: unknown; requirements?: unknown };

    return {
      content: typeof parsed.content === "string" ? parsed.content : "",
      requirements: Array.isArray(parsed.requirements)
        ? parsed.requirements.filter((item): item is string => typeof item === "string")
        : []
    };
  } catch {
    return {
      content: "",
      requirements: [] as string[]
    };
  }
}

export async function createTailorAdvice(formData: FormData) {
  return createTailorRunInternal(formData, "advice");
}

export async function createTailorDraft(formData: FormData) {
  return createTailorRunInternal(formData, "draft");
}

export async function reviseTailorDraftRun(formData: FormData) {
  const user = await requireSessionUser();
  const aiSettings = await getPersistedUserAiSettings(user.id);
  const tailorRunId = formData.get("tailorRunId") as string;
  const customInstructions = ((formData.get("revisionInstructions") as string | null) ?? "").trim();
  const draftTitleInput = ((formData.get("draftTitle") as string | null) ?? "").trim();
  const draftTextInput = ((formData.get("draftText") as string | null) ?? "").trim();

  if (!tailorRunId || !customInstructions) {
    redirect("/tailor");
  }

  const run = await prisma.resumeTailorRun.findFirst({
    where: {
      id: tailorRunId,
      resume: { ownerId: user.id },
      jobLead: { ownerId: user.id }
    },
    include: {
      resume: { select: { id: true, title: true, artifactName: true } },
      jobLead: true
    }
  });

  if (!run) {
    redirect("/tailor");
  }

  const confirmedDocument = await requireConfirmedResumeForTailor(user.id, run.resumeId);

  const currentDraftTitle =
    normalizeDraftTitle(
      draftTitleInput || run.draftTitle || "",
      buildVariantBaseName(
        getResumeSourceName(run.resume.artifactName, run.resume.title),
        run.jobLead.companyName,
        run.jobLead.roleTitle
      )
    ) ||
    buildVariantBaseName(
      getResumeSourceName(run.resume.artifactName, run.resume.title),
      run.jobLead.companyName,
      run.jobLead.roleTitle
    );
  const currentDraftText = normalizeDraftBody(draftTextInput || run.draftText || "");

  if (!currentDraftText) {
    redirect("/tailor");
  }

  const result = await reviseResumeDraft({
    jobTitle: run.jobLead.roleTitle,
    companyName: run.jobLead.companyName,
    resumeText: formatResumeDocument(confirmedDocument.document),
    currentDraftTitle,
    currentDraftText,
    customInstructions,
    settings: aiSettings
  });

  await prisma.resumeTailorRun.update({
    where: { id: run.id },
    data: {
      aiProvider: result.provider,
      aiNote: result.note,
      summary: result.data.summary,
      draftTitle: normalizeDraftTitle(
        result.data.draftTitle || currentDraftTitle,
        buildVariantBaseName(
          getResumeSourceName(run.resume.artifactName, run.resume.title),
          run.jobLead.companyName,
          run.jobLead.roleTitle
        )
      ),
      draftText: normalizeDraftBody(result.data.draftText || currentDraftText),
      suggestionsJson: JSON.stringify({ ...result.data, sourceResumeParseId: confirmedDocument.resumeParseId })
    }
  });

  revalidatePath("/tailor");
  redirect(`/tailor?run=${run.id}&rev=${Date.now()}&ts=${Date.now()}`);
}

export async function createNotificationEvent(
  _previousState: { status: "idle" | "success" | "error"; message?: string },
  formData: FormData
): Promise<{ status: "idle" | "success" | "error"; message?: string }> {
  const user = await requireSessionUser();
  const applicationId = ((formData.get("applicationId") as string | null) ?? "").trim();
  const requestedEventType = (formData.get("eventType") as EventType | null) ?? "NOTE";
  const eventType = Object.values(EventType).includes(requestedEventType) ? requestedEventType : "NOTE";
  const requestedTitle = ((formData.get("title") as string | null) ?? "").trim();
  const file = formData.get("attachment") as File | null;
  const parseDateField = (field: string) => {
    const value = ((formData.get(field) as string | null) ?? "").trim();

    if (!value) {
      return { value: null as Date | null };
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? { error: `无效的 ${field} 时间。` } : { value: date };
  };
  const eventTime = parseDateField("eventTime");
  const windowStartAt = parseDateField("windowStartAt");
  const deadlineAt = parseDateField("deadlineAt");
  const receivedAt = parseDateField("receivedAt");
  const relativeValidityValueRaw = ((formData.get("relativeValidityValue") as string | null) ?? "").trim();
  const relativeValidityUnit = ((formData.get("relativeValidityUnit") as string | null) ?? "").trim();

  if (eventTime.error || windowStartAt.error || deadlineAt.error || receivedAt.error) {
    return { status: "error", message: eventTime.error || windowStartAt.error || deadlineAt.error || receivedAt.error };
  }

  if (windowStartAt.value && deadlineAt.value && windowStartAt.value > deadlineAt.value) {
    return { status: "error", message: "开始时间不得晚于截止时间。" };
  }

  let relativeValidityMinutes: number | null = null;

  if (relativeValidityValueRaw) {
    const relativeValidityValue = Number(relativeValidityValueRaw);
    const multiplier = relativeValidityUnit === "hours" ? 60 : relativeValidityUnit === "days" ? 24 * 60 : null;

    if (!Number.isFinite(relativeValidityValue) || relativeValidityValue <= 0 || !multiplier) {
      return { status: "error", message: "有效时长必须是正数，并以小时或天为单位。" };
    }

    relativeValidityMinutes = relativeValidityValue * multiplier;

    if (!Number.isInteger(relativeValidityMinutes) || relativeValidityMinutes <= 0) {
      return { status: "error", message: "有效时长必须能转换为正整数分钟。" };
    }

    if (!receivedAt.value) {
      return { status: "error", message: "填写有效时长时必须填写接收时间。" };
    }
  }

  const application = await prisma.application.findFirst({
    where: { id: applicationId, jobLead: { ownerId: user.id } }
  });

  if (!application) {
    return { status: "error", message: "请选择一个有效的关联申请。" };
  }

  try {
    const uploaded = file && file.size > 0 ? await persistUpload(file, "notifications") : null;
    const content =
      ((formData.get("content") as string | null) ?? "").trim() || uploaded?.extractedText?.trim() || "";

    if (!content) {
      return { status: "error", message: "请填写通知内容或上传包含可提取文本的附件。" };
    }

    const title = requestedTitle || content.replace(/\s+/g, " ").trim().slice(0, 100) || "导入通知";

    await prisma.event.create({
      data: {
        applicationId: application.id,
        eventType,
        title,
        eventTime: eventTime.value,
        windowStartAt: windowStartAt.value,
        deadlineAt: deadlineAt.value,
        receivedAt: receivedAt.value,
        relativeValidityMinutes,
        artifactName: uploaded?.originalName,
        artifactUrl: uploaded?.fileUrl,
        detailsJson: JSON.stringify({ content, requirements: [] })
      }
    });

    revalidatePath("/");
    revalidatePath("/board");
    revalidatePath("/notifications");
    revalidatePath(`/notifications/${application.id}`);
    revalidatePath(`/jobs/${application.jobLeadId}`);

    return { status: "success" };
  } catch (error) {
    console.error("Unable to create notification event", error);
    return { status: "error", message: "保存通知失败，请检查附件或稍后重试。" };
  }
}

export async function updateNotificationEvent(formData: FormData) {
  const user = await requireSessionUser();
  const eventId = formData.get("eventId") as string;
  const title = ((formData.get("title") as string | null) ?? "").trim();
  const requestedEventType = formData.get("eventType") as EventType | null;
  const eventType = requestedEventType && Object.values(EventType).includes(requestedEventType) ? requestedEventType : null;
  const contentInput = formData.get("content");
  const requirementsText = ((formData.get("requirementsText") as string | null) ?? "").trim();
  const parseDateField = (field: string) => {
    const value = ((formData.get(field) as string | null) ?? "").trim();

    if (!value) {
      return { value: null as Date | null };
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? { error: `无效的 ${field} 时间。` } : { value: date };
  };
  const eventTime = parseDateField("eventTime");
  const windowStartAt = parseDateField("windowStartAt");
  const deadlineAt = parseDateField("deadlineAt");
  const receivedAt = parseDateField("receivedAt");
  const relativeValidityValueRaw = ((formData.get("relativeValidityValue") as string | null) ?? "").trim();
  const relativeValidityUnit = ((formData.get("relativeValidityUnit") as string | null) ?? "").trim();

  if (!eventId || !title || !eventType) {
    return;
  }

  if (eventTime.error || windowStartAt.error || deadlineAt.error || receivedAt.error) {
    return;
  }

  if (windowStartAt.value && deadlineAt.value && windowStartAt.value > deadlineAt.value) {
    return;
  }

  let relativeValidityMinutes: number | null = null;

  if (relativeValidityValueRaw) {
    const relativeValidityValue = Number(relativeValidityValueRaw);
    const multiplier = relativeValidityUnit === "hours" ? 60 : relativeValidityUnit === "days" ? 24 * 60 : null;

    if (!Number.isFinite(relativeValidityValue) || relativeValidityValue <= 0 || !multiplier) {
      return;
    }

    relativeValidityMinutes = relativeValidityValue * multiplier;

    if (!Number.isInteger(relativeValidityMinutes) || relativeValidityMinutes <= 0 || !receivedAt.value) {
      return;
    }
  }

  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      application: { jobLead: { ownerId: user.id } }
    },
    include: {
      application: true
    }
  });

  if (!event) {
    return;
  }

  const existingDetails = safeEventDetails(event.detailsJson);
  const content = typeof contentInput === "string" ? contentInput.trim() : existingDetails.content;
  const requirements = JSON.parse(multilineToJson(requirementsText)) as string[];

  await prisma.event.update({
    where: { id: event.id },
    data: {
      title,
      eventType,
      eventTime: eventTime.value,
      windowStartAt: windowStartAt.value,
      deadlineAt: deadlineAt.value,
      receivedAt: receivedAt.value,
      relativeValidityMinutes,
      detailsJson: JSON.stringify({
        content,
        requirements
      })
    }
  });

  revalidatePath("/");
  revalidatePath("/board");
  revalidatePath("/notifications");
  revalidatePath(`/notifications/${event.applicationId}`);
  revalidatePath(`/jobs/${event.application.jobLeadId}`);
}

function safeEventDetails(detailsJson: string) {
  try {
    const parsed = JSON.parse(detailsJson) as { content?: unknown };
    return { content: typeof parsed.content === "string" ? parsed.content : "" };
  } catch {
    return { content: "" };
  }
}
