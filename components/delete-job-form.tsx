"use client";

import { useTransition } from "react";
import { deleteJobLead } from "@/app/actions";

export function DeleteJobForm({
  jobLeadId,
  onDeleted
}: {
  jobLeadId: string;
  onDeleted?: (jobLeadId: string) => void;
}) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    const confirmed = window.confirm(
      "确认删除这个岗位吗？删除后会同时清理这条岗位的申请记录和相关事件。"
    );

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("jobLeadId", jobLeadId);
      await deleteJobLead(formData);
      onDeleted?.(jobLeadId);
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleDelete}
      className="inline-flex h-8 min-w-[84px] items-center justify-center rounded-lg bg-rose-600 px-3 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "删除中..." : "删除岗位"}
    </button>
  );
}
