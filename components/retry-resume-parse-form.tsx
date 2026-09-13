"use client";

import { retryResumeParse } from "@/app/actions";

export function RetryResumeParseForm({ failedParseId }: { failedParseId: string }) {
  return (
    <form action={retryResumeParse}>
      <input type="hidden" name="failedParseId" value={failedParseId} />
      <button className="inline-flex h-9 items-center justify-center rounded-xl border border-line bg-white px-3 text-sm font-medium text-ink">
        重试解析
      </button>
    </form>
  );
}
