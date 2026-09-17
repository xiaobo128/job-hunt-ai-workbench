"use client";

import { deleteResume } from "@/app/actions";

export function DeleteResumeForm({
  resumeId
}: {
  resumeId: string;
}) {
  return (
    <form
      action={deleteResume}
      onSubmit={(event) => {
        const confirmed = window.confirm("确认删除这个简历版本吗？删除后会同时清理它关联的解析、微调记录和定制版本。");

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="resumeId" value={resumeId} />
      <button className="inline-flex h-10 min-w-[124px] items-center justify-center rounded-xl bg-rose-600 px-4 text-sm font-medium text-white">
        删除此版本
      </button>
    </form>
  );
}
