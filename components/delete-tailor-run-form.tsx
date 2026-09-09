"use client";

import { deleteTailorRun } from "@/app/actions";

export function DeleteTailorRunForm({
  tailorRunId
}: {
  tailorRunId: string;
}) {
  return (
    <form
      action={deleteTailorRun}
      onSubmit={(event) => {
        const confirmed = window.confirm("确认撤销本次微调吗？这会删除这条建议记录和草稿内容。");

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="tailorRunId" value={tailorRunId} />
      <button className="inline-flex h-10 items-center justify-center rounded-xl border border-rose-200 px-4 text-sm font-medium text-rose-600">
        撤销本次微调
      </button>
    </form>
  );
}
