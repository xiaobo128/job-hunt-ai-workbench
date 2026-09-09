"use client";

import { useRef } from "react";
import { updateApplicationStage } from "@/app/actions";

type StageOption = {
  value: string;
  label: string;
};

export function BoardStageForm({
  applicationId,
  currentStage,
  stageOptions,
  actionSlot
}: {
  applicationId: string;
  currentStage: string;
  stageOptions: readonly StageOption[];
  actionSlot: React.ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const previousStageRef = useRef(currentStage);

  return (
    <form ref={formRef} action={updateApplicationStage} className="mt-3 space-y-2">
      <input type="hidden" name="applicationId" value={applicationId} />
      <input type="hidden" name="note" value="" />

      <div className="flex items-center justify-between gap-2">
        <select
          name="stage"
          defaultValue={currentStage}
          className="min-w-[96px] rounded-xl border border-line bg-white px-2.5 py-1.5 text-[11px] font-medium text-ink outline-none"
          onFocus={(event) => {
            previousStageRef.current = event.currentTarget.value;
          }}
          onChange={(event) => {
            const nextStage = event.currentTarget.value;
            const previousStage = previousStageRef.current;

            if (nextStage === previousStage) {
              return;
            }

            const confirmed = window.confirm("确认更新这个岗位的申请阶段吗？当前填写的备注也会一起保存。");

            if (!confirmed) {
              event.currentTarget.value = previousStage;
              return;
            }

            previousStageRef.current = nextStage;
            formRef.current?.requestSubmit();
          }}
        >
          {stageOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {actionSlot}
      </div>

      <div className="text-[11px] text-slate-400">这个旧组件仅保留阶段切换能力，备注内容请在岗位工作台里维护。</div>
    </form>
  );
}
