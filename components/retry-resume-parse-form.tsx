"use client";

import { useFormStatus } from "react-dom";
import { retryResumeParse } from "@/app/actions";

export function RetryResumeParseForm({ parseId }: { parseId: string }) {
  return (
    <form action={retryResumeParse}>
      <input type="hidden" name="parseId" value={parseId} />
      <RetryButton />
    </form>
  );
}

function RetryButton() {
  const { pending } = useFormStatus();

  return (
    <button disabled={pending} className="inline-flex h-9 items-center justify-center rounded-xl border border-line bg-white px-3 text-sm font-medium text-ink disabled:cursor-wait disabled:opacity-70">
      {pending ? "正在重新处理..." : "重新处理"}
    </button>
  );
}
