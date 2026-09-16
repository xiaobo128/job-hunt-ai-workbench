"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteJobLead } from "@/app/actions";

export function DeleteJobForm({
  jobLeadId,
  onDeleted,
  redirectTo
}: {
  jobLeadId: string;
  onDeleted?: (jobLeadId: string) => void;
  redirectTo?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();

  function handleDelete() {
    const confirmed = window.confirm(
      "确认删除这个岗位吗？删除后会同时清理这条岗位的申请记录和相关事件。"
    );

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      try {
        setError("");
        const formData = new FormData();
        formData.set("jobLeadId", jobLeadId);
        const result = await deleteJobLead(formData);

        if (!result?.deleted) {
          setError("未能删除该岗位，请刷新后重试。");
          return;
        }

        onDeleted?.(jobLeadId);
        if (redirectTo) {
          router.push(redirectTo);
          router.refresh();
        }
      } catch {
        setError("删除失败，请稍后重试。");
      }
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={handleDelete}
        className="inline-flex h-8 min-w-[84px] items-center justify-center rounded-lg bg-rose-600 px-3 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? "删除中..." : "删除岗位"}
      </button>
      {error ? <p role="alert" className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
