"use client";

import { deleteResumeAsset } from "@/app/actions";

export function DeleteResumeAssetForm({ assetId }: { assetId: string }) {
  return (
    <form
      action={deleteResumeAsset}
      onSubmit={(event) => {
        const confirmed = window.confirm("确认删除这份源文件吗？如果它正被当作预览源或编辑源，系统会自动切换到其他可用文件。");

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="assetId" value={assetId} />
      <button className="inline-flex h-10 min-w-[124px] items-center justify-center rounded-xl border border-rose-200 bg-white px-4 text-sm font-medium text-rose-600">
        删除源文件
      </button>
    </form>
  );
}
