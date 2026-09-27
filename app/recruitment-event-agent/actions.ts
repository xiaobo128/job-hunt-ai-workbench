"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { extractRecruitmentEvent, type RecruitmentEventExtraction } from "@/lib/ai";
import { matchRecruitmentEventToApplications, type RecruitmentApplicationMatch } from "@/lib/recruitment-event-matching";
import { createRecruitmentEventProposalIfHighConfidence, type RecruitmentEventProposalResult } from "@/lib/recruitment-event-proposals";
import { requireSessionUser } from "@/lib/session";

export type RecruitmentEventAgentState = {
  status: "idle" | "success" | "error";
  message?: string;
  provider?: "openai" | "local";
  note?: string;
  extraction?: RecruitmentEventExtraction;
  matches?: RecruitmentApplicationMatch[];
  proposal?: RecruitmentEventProposalResult;
  input?: RecruitmentEventAgentInput;
};

type RecruitmentEventAgentInput = {
  subject: string;
  sender: string;
  receivedAt: string | null;
  content: string;
  identifier: string | null;
};

export async function processRecruitmentEvent(
  _previousState: RecruitmentEventAgentState,
  formData: FormData
): Promise<RecruitmentEventAgentState> {
  const user = await requireSessionUser();
  const selectedApplicationId = optionalTextValue(formData, "selectedApplicationId");

  if (selectedApplicationId) {
    if (
      _previousState.status !== "success" ||
      !_previousState.extraction ||
      !_previousState.proposal ||
      _previousState.proposal.created ||
      !_previousState.input
    ) {
      return { status: "error", message: "候选申请已失效，请重新解析通知。" };
    }

    try {
      const proposal = await createRecruitmentEventProposalIfHighConfidence({
        userId: user.id,
        extraction: _previousState.extraction,
        candidates: _previousState.proposal.candidates,
        subject: _previousState.input.subject,
        receivedAt: _previousState.input.receivedAt,
        content: _previousState.input.content,
        identifier: _previousState.input.identifier,
        selectedApplicationId
      });

      if (!proposal.created) {
        return { status: "error", message: "所选申请已失效，请重新解析通知。" };
      }

      revalidatePath("/proposals");
      return { ..._previousState, proposal };
    } catch {
      return { status: "error", message: "创建通知确认项失败，请重新解析后再试。" };
    }
  }

  const subject = textValue(formData, "subject");
  const sender = textValue(formData, "sender");
  const receivedAt = optionalTextValue(formData, "receivedAt");
  const content = rawTextValue(formData, "content");
  const identifier = optionalTextValue(formData, "identifier");

  if (!content.trim()) {
    return { status: "error", message: "请粘贴招聘邮件或通知正文。" };
  }

  try {
    const [applications, extracted] = await Promise.all([
      prisma.application.findMany({
        where: {
          currentStage: { notIn: ["CLOSED", "REJECTED"] },
          jobLead: { ownerId: user.id, status: { notIn: ["CLOSED", "REJECTED"] } }
        },
        select: {
          id: true,
          jobLead: { select: { companyName: true, roleTitle: true, city: true } }
        },
        orderBy: { updatedAt: "desc" },
        take: 100
      }),
      extractRecruitmentEvent({
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
      })
    ]);
    const matches = matchRecruitmentEventToApplications(
      extracted.data,
      applications.map((application) => ({
        applicationId: application.id,
        companyName: application.jobLead.companyName,
        roleTitle: application.jobLead.roleTitle,
        city: application.jobLead.city
      }))
    );
    const proposal = await createRecruitmentEventProposalIfHighConfidence({
      userId: user.id,
      extraction: extracted.data,
      candidates: matches,
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
      matches,
      proposal,
      input: { subject, sender, receivedAt, content, identifier }
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
