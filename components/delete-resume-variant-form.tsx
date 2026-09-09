"use client";

import { deleteResumeVariant } from "@/app/actions";

export function DeleteResumeVariantForm({ variantId }: { variantId: string }) {
  return (
    <form
      action={deleteResumeVariant}
      onSubmit={(event) => {
        if (!window.confirm("确定删除这个定制版本吗？")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="variantId" value={variantId} />
      <button className="inline-flex h-10 items-center justify-center rounded-xl border border-rose-100 bg-white px-4 text-sm font-medium text-rose-600">
        删除
      </button>
    </form>
  );
}
