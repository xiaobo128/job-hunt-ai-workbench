"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteResume, setCurrentResume } from "@/app/actions";

export function ResumeVersionActions({ resumeId, reviewHref, canSetCurrent }: { resumeId: string; reviewHref?: string; canSetCurrent: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: "set-current" | "delete") => {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("resumeId", resumeId);
      const result = action === "set-current" ? await setCurrentResume(formData) : await deleteResume(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setConfirmingDelete(false);
      setOpen(false);
      router.refresh();
    });
  };

  return <div className="relative shrink-0">
    <button type="button" aria-label="简历版本更多操作" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="flex size-9 items-center justify-center rounded-xl text-lg leading-none text-slate-500 transition hover:bg-panel hover:text-ink">···</button>
    {open ? <div role="menu" className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-line bg-white p-1.5 shadow-card">
      {reviewHref ? <a href={reviewHref} role="menuitem" onClick={() => setOpen(false)} className="flex rounded-lg px-3 py-2 text-sm font-medium text-ink hover:bg-panel">确认候选人资料</a> : null}
      {canSetCurrent ? <button type="button" role="menuitem" disabled={pending} onClick={() => run("set-current")} className="flex w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-ink hover:bg-panel disabled:opacity-60">{pending ? "处理中…" : "设为主简历"}</button> : null}
      <button type="button" role="menuitem" disabled={pending} onClick={() => { setOpen(false); setConfirmingDelete(true); }} className="flex w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60">删除此版本</button>
    </div> : null}
    {confirmingDelete ? <div role="dialog" aria-modal="true" aria-labelledby={`delete-resume-${resumeId}`} className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-line bg-white p-5 shadow-card">
        <h2 id={`delete-resume-${resumeId}`} className="text-lg font-semibold text-ink">删除这个简历版本？</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">删除后，该简历版本及其关联解析记录将不可恢复。不会影响其他简历版本。</p>
        {error ? <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-3"><button type="button" disabled={pending} onClick={() => setConfirmingDelete(false)} className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-ink">取消</button><button type="button" disabled={pending} onClick={() => run("delete")} className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">{pending ? "删除中…" : "删除"}</button></div>
      </div>
    </div> : null}
  </div>;
}
