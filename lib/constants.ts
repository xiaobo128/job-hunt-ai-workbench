import type { ApplicationStage } from "@prisma/client";

const stageBadgeBaseClassName = "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset";

export const applicationStageConfig: Record<ApplicationStage, { label: string; badgeClassName: string; order: number; legacy?: boolean }> = {
  INTERESTED: { label: "待投递", badgeClassName: "bg-slate-100 text-slate-700 ring-slate-200", order: 0, legacy: true },
  READY_TO_APPLY: { label: "待投递", badgeClassName: "bg-slate-100 text-slate-700 ring-slate-200", order: 1 },
  APPLIED: { label: "已投递", badgeClassName: "bg-sky-50 text-sky-700 ring-sky-200", order: 2 },
  ASSESSMENT: { label: "提交测评", badgeClassName: "bg-orange-50 text-orange-700 ring-orange-200", order: 3 },
  WRITTEN_TEST: { label: "笔试", badgeClassName: "bg-amber-50 text-amber-700 ring-amber-200", order: 4 },
  INTERVIEW: { label: "面试", badgeClassName: "bg-violet-50 text-violet-700 ring-violet-200", order: 5 },
  FIRST_INTERVIEW: { label: "一面", badgeClassName: "bg-purple-50 text-purple-700 ring-purple-200", order: 6 },
  SECOND_INTERVIEW: { label: "二面", badgeClassName: "bg-indigo-50 text-indigo-700 ring-indigo-200", order: 7 },
  THIRD_INTERVIEW: { label: "三面", badgeClassName: "bg-indigo-100 text-indigo-800 ring-indigo-200", order: 8 },
  FINAL_INTERVIEW: { label: "终面", badgeClassName: "bg-indigo-100 text-indigo-800 ring-indigo-300", order: 9, legacy: true },
  NEGOTIATION: { label: "谈薪", badgeClassName: "bg-yellow-50 text-yellow-800 ring-yellow-200", order: 10 },
  OFFER: { label: "已录用", badgeClassName: "bg-emerald-50 text-emerald-700 ring-emerald-200", order: 11 },
  REJECTED: { label: "未通过", badgeClassName: "bg-rose-50 text-rose-700 ring-rose-200", order: 12 },
  CLOSED: { label: "已结束", badgeClassName: "bg-zinc-100 text-zinc-600 ring-zinc-200", order: 13 }
};

export const stageOptions = (Object.entries(applicationStageConfig) as Array<[ApplicationStage, (typeof applicationStageConfig)[ApplicationStage]]>)
  .filter(([, config]) => !config.legacy)
  .sort(([, left], [, right]) => left.order - right.order)
  .map(([value, config]) => ({ value, label: config.label, badgeClassName: `${stageBadgeBaseClassName} ${config.badgeClassName}`, order: config.order }));

export function normalizeApplicationStage(stage: ApplicationStage): ApplicationStage {
  if (stage === "INTERESTED") {
    return "READY_TO_APPLY";
  }

  if (stage === "FINAL_INTERVIEW") {
    return "INTERVIEW";
  }

  return stage;
}

export function getStageLabel(stage: ApplicationStage) {
  return applicationStageConfig[normalizeApplicationStage(stage)].label;
}

export function getApplicationStageBadgeClass(stage: ApplicationStage) {
  return `${stageBadgeBaseClassName} ${applicationStageConfig[normalizeApplicationStage(stage)].badgeClassName}`;
}

export function getStageDisplayLabel(stage: ApplicationStage, customLabel?: string | null) {
  const baseLabel = getStageLabel(stage);
  const extra = customLabel?.trim();

  return extra ? `${baseLabel} · ${extra}` : baseLabel;
}
