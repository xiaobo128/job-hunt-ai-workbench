"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { extractRecruitmentEvent, type RecruitmentEventExtraction } from "@/lib/ai";
import { createRecruitmentEventProposal, type RecruitmentEventProposalResult } from "@/lib/recruitment-event-proposals";
import { requireSessionUser } from "@/lib/session";

export type RecruitmentEventAgentState = {
  status: "idle" | "success" | "error";
  message?: string;
  provider?: "openai" | "local";
  note?: string;
  extraction?: RecruitmentEventExtraction;
  proposal?: RecruitmentEventProposalResult;
};

export async function processRecruitmentEvent(
  _previousState: RecruitmentEventAgentState,
  formData: FormData
): Promise<RecruitmentEventAgentState> {
  const user = await requireSessionUser();
  const applicationId = textValue(formData, "applicationId");
  const subject = textValue(formData, "subject");
  const sender = textValue(formData, "sender");
  const receivedAt = optionalTextValue(formData, "receivedAt");
  const content = rawTextValue(formData, "content");
  const identifier = optionalTextValue(formData, "identifier");

  if (!applicationId) {
    return { status: "error", message: "请选择关联岗位。" };
  }
  if (!content.trim()) {
    return { status: "error", message: "请粘贴招聘邮件或通知正文。" };
  }
  if (receivedAt && !isDateTimeLocal(receivedAt)) {
    return { status: "error", message: "接收时间无效，请重新选择日期和时间。" };
  }

  try {
    const application = await prisma.application.findFirst({
      where: {
        id: applicationId,
        currentStage: { notIn: ["CLOSED", "REJECTED"] },
        jobLead: { ownerId: user.id, status: { notIn: ["CLOSED", "REJECTED"] } }
      },
      select: { id: true, jobLead: { select: { companyName: true, roleTitle: true } } }
    });
    if (!application) {
      return { status: "error", message: "所选申请不存在、已关闭或已被拒绝，请重新选择。" };
    }

    const extracted = await extractRecruitmentEvent({
      subject,
      sender,
      receivedAt,
      content,
      settings: {
        provider: user.aiProvider,
        apiKey: user.aiApiKey,
        apiBaseUrl: user.aiApiBaseUrl,
        forwardHost: user.aiForwardHost,
        model: user.aiModel,
        visionModel: user.aiVisionModel
      }
    });
    const proposal = await createRecruitmentEventProposal({
      userId: user.id,
      extraction: extracted.data,
      application: {
        applicationId: application.id,
        companyName: application.jobLead.companyName,
        roleTitle: application.jobLead.roleTitle
      },
      subject,
      receivedAt,
      content,
      identifier
    });

    if (proposal.created) {
      revalidatePath("/proposals");
    }

    return {
      status: "success",
      provider: extracted.provider,
      note: extracted.note,
      extraction: extracted.data,
      proposal
    };
  } catch {
    return { status: "error", message: "招聘事件处理失败，请检查内容后重试。" };
  }
}

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalTextValue(formData: FormData, key: string) {
  return textValue(formData, key) || null;
}

function rawTextValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function isDateTimeLocal(value: string) {
  return /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}
