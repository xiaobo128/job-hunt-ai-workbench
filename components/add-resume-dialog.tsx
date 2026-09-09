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
        导入原始简历
      </button>

      {open
        ? createPortal(
            <div className="fixed inset-0 z-[100] bg-slate-950/30 p-4 backdrop-blur-sm sm:p-6">
              <div className="flex min-h-full items-center justify-center">
                <div className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-line bg-white p-5 shadow-card sm:max-h-[calc(100vh-3rem)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-ink">导入原始简历</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        上传原始文件并补充版本备注，比如写了哪些经历、没写哪些项目、适合什么岗位。
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
                      上传原始简历源文件
                      <input
                        type="file"
                        name="resumeFiles"
                        multiple
                        accept=".txt,.md,.pdf,.doc,.docx,image/*"
                        className="mt-2 block w-full rounded-2xl border border-dashed border-line bg-panel px-4 py-3 text-sm outline-none file:mr-3 file:rounded-xl file:border-0 file:bg-ink file:px-3 file:py-2 file:text-white"
                      />
                      <span className="mt-2 block text-xs text-slate-400">
                        支持文本、PDF、Word 和图片。可以一次上传多份同源文件，比如 `DOCX + PDF`；系统会自动挑选更适合预览和微调的来源。
                      </span>
                    </label>

                    <label className="block text-sm text-slate-600">
                      版本备注
                      <textarea
                        name="note"
                        rows={6}
                        className="mt-2 w-full rounded-3xl border border-line bg-panel px-4 py-3 outline-none"
                        placeholder="例如：这个版本突出增长经历，没有展开中后台项目，主要用于 AI 产品和增长产品岗位。"
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
                      <button className="rounded-2xl bg-ink px-5 py-3 text-sm font-medium text-white">保存简历</button>
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
