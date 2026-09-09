"use client";

import { retryResumeAssetExtraction } from "@/app/actions";

export function RetryResumeAssetExtractionForm({ assetId }: { assetId: string }) {
  return (
    <form action={retryResumeAssetExtraction}>
      <input type="hidden" name="assetId" value={assetId} />
      <button className="inline-flex h-10 min-w-[124px] items-center justify-center rounded-xl border border-line bg-white px-4 text-sm font-medium text-ink">
        重新提取正文
      </button>
    </form>
  );
}
