import type { ApplicationStage } from "@prisma/client";
import { getApplicationStageBadgeClass, getStageDisplayLabel } from "@/lib/constants";

export function ApplicationStageBadge({ stage, customLabel }: { stage: ApplicationStage; customLabel?: string | null }) {
  return <span className={getApplicationStageBadgeClass(stage)}>{getStageDisplayLabel(stage, customLabel)}</span>;
}
