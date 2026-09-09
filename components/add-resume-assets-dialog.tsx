"use client";

import { useState } from "react";
import { createResumeAssets } from "@/app/actions";

export function AddResumeAssetsDialog({ resumeId }: { resumeId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 min-w-[132px] items-center justify-center rounded-xl border border-line bg-white px-4 text-sm font-medium text-ink"
      >
        补传源文件
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/30 p-4 backdrop-blur-sm">
          <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-line bg-white p-5 shadow-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-ink">补传原始简历源文件</h2>
                <p className="mt-1 text-sm text-slate-500">
                  建议把同一份原始简历的 DOCX 和 PDF 都挂进来。DOCX 更适合作为编辑源，PDF 更适合作为预览源。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="关闭"
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-line text-xl leading-none text-slate-500"
              >
                x
              </button>
            </div>

            <form action={createResumeAssets} className="mt-5 space-y-4" encType="multipart/form-data">
              <input type="hidden" name="resumeId" value={resumeId} />

              <label className="block text-sm text-slate-600">
                上传源文件
                <input
                  type="file"
                  name="resumeFiles"
                  required
                  multiple
                  accept=".txt,.md,.pdf,.doc,.docx,image/*"
                  className="mt-2 block w-full rounded-2xl border border-dashed border-line bg-panel px-4 py-3 text-sm outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-ink file:px-3 file:py-2 file:text-white"
                />
                <span className="mt-2 block text-xs text-slate-400">
                  可以一次上传多个文件。系统会自动判断哪份更适合预览，哪份更适合作为微调时的正文来源。
                </span>
              </label>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-line px-4 text-sm font-medium text-ink"
                >
                  取消
                </button>
                <button className="inline-flex h-10 items-center justify-center rounded-xl bg-ink px-4 text-sm font-medium text-white">
                  保存源文件
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
