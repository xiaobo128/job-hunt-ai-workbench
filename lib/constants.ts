import type { ApplicationStage } from "@prisma/client";

export const stageLabelMap: Record<ApplicationStage, string> = {
  INTERESTED: "待投递",
  READY_TO_APPLY: "待投递",
  APPLIED: "已投递",
  ASSESSMENT: "提交测评",
  INTERVIEW: "面试",
  FIRST_INTERVIEW: "面试",
  SECOND_INTERVIEW: "面试",
  THIRD_INTERVIEW: "面试",
  FINAL_INTERVIEW: "面试",
  NEGOTIATION: "谈薪",
  OFFER: "已获录用",
  CLOSED: "已结束"
};

export const stageOptions: Array<{ value: ApplicationStage; label: string }> = [
  { value: "READY_TO_APPLY", label: "待投递" },
  { value: "APPLIED", label: "已投递" },
  { value: "ASSESSMENT", label: "提交测评" },
  { value: "INTERVIEW", label: "面试" },
  { value: "NEGOTIATION", label: "谈薪" },
  { value: "OFFER", label: "已获录用" },
  { value: "CLOSED", label: "已结束" }
];

export function normalizeApplicationStage(stage: ApplicationStage): ApplicationStage {
  if (stage === "INTERESTED") {
    return "READY_TO_APPLY";
  }

  if (stage === "FIRST_INTERVIEW" || stage === "SECOND_INTERVIEW" || stage === "THIRD_INTERVIEW" || stage === "FINAL_INTERVIEW") {
    return "INTERVIEW";
  }

  return stage;
}

export function getStageLabel(stage: ApplicationStage) {
  return stageLabelMap[normalizeApplicationStage(stage)];
}

export function getStageDisplayLabel(stage: ApplicationStage, customLabel?: string | null) {
  const baseLabel = getStageLabel(stage);
  const extra = customLabel?.trim();

  return extra ? `${baseLabel} · ${extra}` : baseLabel;
}
