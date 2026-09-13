"use client";

import { useState } from "react";

export function CopyTextButton({ text }: { text: string }) {
  const [message, setMessage] = useState<string | null>(null);
  async function copy() {
    try { await navigator.clipboard.writeText(text); setMessage("复制成功"); }
    catch { setMessage("复制失败"); }
  }
  return <span className="inline-flex items-center gap-2"><button type="button" onClick={copy} className="text-xs font-medium text-accent underline-offset-4 hover:underline">复制</button>{message ? <span role="status" className="text-xs text-slate-500">{message}</span> : null}</span>;
}
