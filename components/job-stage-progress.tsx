import type { ApplicationStage } from "@prisma/client";
import { updateApplicationStage } from "@/app/actions";

const stageNodes = [
  { label: "已保存 / 待投递", stage: "READY_TO_APPLY", matches: ["INTERESTED", "READY_TO_APPLY"] },
  { label: "已投递", stage: "APPLIED", matches: ["APPLIED"] },
  { label: "笔试", stage: "ASSESSMENT", matches: ["ASSESSMENT"] },
  {
    label: "面试",
    stage: "INTERVIEW",
    matches: ["INTERVIEW", "FIRST_INTERVIEW", "SECOND_INTERVIEW", "THIRD_INTERVIEW", "FINAL_INTERVIEW"]
  },
  { label: "Offer", stage: "OFFER", matches: ["NEGOTIATION", "OFFER"] }
] as const satisfies ReadonlyArray<{
  label: string;
  stage: ApplicationStage;
  matches: readonly ApplicationStage[];
}>;

export function JobStageProgress({
  applicationId,
  currentStage,
  hasRejectionEvent
}: {
  applicationId: string;
  currentStage: ApplicationStage;
  hasRejectionEvent: boolean;
}) {
  const isTerminal = currentStage === "CLOSED" || currentStage === "REJECTED";
  const currentIndex = isTerminal ? -1 : stageNodes.findIndex((node) => node.matches.some((stage) => stage === currentStage));
  const terminalLabel = currentStage === "REJECTED" ? "未通过" : currentStage === "CLOSED" ? (hasRejectionEvent ? "已拒绝" : "已终止") : null;

  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div className="relative min-w-[620px]">
          <div aria-hidden="true" className="absolute left-[10%] right-[10%] top-4 h-px bg-line" />
          <ol aria-label="求职阶段进度" className="flex items-start justify-between gap-2 px-1">
            {stageNodes.map((node, index) => {
              const isCurrent = index === currentIndex;
              const isComplete = currentIndex > index;
              const nodeClassName = isCurrent
                ? "border-accent bg-accent text-white"
                : isComplete
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-line bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-ink";
              const markerClassName = isCurrent
                ? "bg-white text-accent"
                : isComplete
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-200 text-slate-500";

              return (
                <li key={node.stage} className="relative z-10 flex w-[112px] shrink-0 justify-center">
                  {isCurrent ? (
                    <div aria-current="step" className={`flex w-full flex-col items-center rounded-2xl border px-2 py-2 text-center text-xs font-medium ${nodeClassName}`}>
                      <span className={`flex size-6 items-center justify-center rounded-full text-xs font-semibold ${markerClassName}`}>{index + 1}</span>
                      <span className="mt-1.5 leading-5">{node.label}</span>
                    </div>
                  ) : (
                    <form action={updateApplicationStage} className="w-full">
                      <input type="hidden" name="applicationId" value={applicationId} />
                      <input type="hidden" name="stage" value={node.stage} />
                      <button
                        type="submit"
                        aria-label={`将求职阶段更新为${node.label}`}
                        className={`flex w-full flex-col items-center rounded-2xl border px-2 py-2 text-center text-xs font-medium transition ${nodeClassName}`}
                      >
                        <span className={`flex size-6 items-center justify-center rounded-full text-xs font-semibold ${markerClassName}`}>
                          {isComplete ? "✓" : index + 1}
                        </span>
                        <span className="mt-1.5 leading-5">{node.label}</span>
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {terminalLabel ? (
        <div className="mt-3 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
          当前终止状态：{terminalLabel}
        </div>
      ) : null}
    </div>
  );
}
