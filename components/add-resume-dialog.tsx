"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { createResume } from "@/app/actions";

export function AddResumeDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-white"
      >
        上传主简历
      </button>

      {open
        ? createPortal(
            <div className="fixed inset-0 z-[100] bg-slate-950/30 p-4 backdrop-blur-sm sm:p-6">
              <div className="flex min-h-full items-center justify-center">
                <div className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-line bg-white p-5 shadow-card sm:max-h-[calc(100vh-3rem)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-ink">上传主简历</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        上传当前主简历，并补充候选人资料说明。
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

                  <form action={createResume} className="mt-5 space-y-4">
                    <label className="block text-sm text-slate-600">
                      简历名称
                      <input
                        name="title"
                        required
                        className="mt-2 w-full rounded-2xl border border-line bg-panel px-4 py-3 outline-none"
                        placeholder="例如：产品经理通用版 / AI 岗增强版"
                      />
                    </label>

                    <label className="block text-sm text-slate-600">
                      主简历文件
                      <input
                        type="file"
                        name="resumeFiles"
                        multiple
                        accept=".txt,.md,.pdf,.doc,.docx,image/*"
                        className="mt-2 block w-full rounded-2xl border border-dashed border-line bg-panel px-4 py-3 text-sm outline-none file:mr-3 file:rounded-xl file:border-0 file:bg-ink file:px-3 file:py-2 file:text-white"
                      />
                      <span className="mt-2 block text-xs text-slate-400">
                        支持文本、PDF、Word 和图片。可一次上传 DOCX 和 PDF，系统会自动整理候选人资料。
                      </span>
                    </label>

                    <label className="block text-sm text-slate-600">
                      资料说明
                      <textarea
                        name="note"
                        rows={6}
                        className="mt-2 w-full rounded-3xl border border-line bg-panel px-4 py-3 outline-none"
                        placeholder="例如：重点经历、求职方向或需要补充确认的信息。"
                      />
                    </label>

                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="rounded-2xl border border-line px-4 py-3 text-sm font-medium text-ink"
                      >
                        取消
                      </button>
                      <button className="rounded-2xl bg-ink px-5 py-3 text-sm font-medium text-white">保存主简历</button>
                    </div>
                  </form>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
