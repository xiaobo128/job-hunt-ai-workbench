"use client";

import { useState } from "react";
import { createManualResumeVariant } from "@/app/actions";

type JobOption = {
  id: string;
  label: string;
};

export function AddResumeVariantDialog({
  resumeId,
  jobs
}: {
  resumeId: string;
  jobs: JobOption[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 min-w-[132px] items-center justify-center rounded-xl border border-line bg-white px-4 text-sm font-medium text-ink"
      >
        上传手动修改版
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/30 p-4 backdrop-blur-sm">
          <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-line bg-white p-5 shadow-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-ink">上传定制简历</h2>
                <p className="mt-1 text-sm text-slate-500">
                  适合把你根据微调建议手动改好的 PDF / DOCX 归档到这个原始版本下面。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-line px-4 text-sm text-slate-500"
              >
                关闭
              </button>
            </div>

            <form action={createManualResumeVariant} className="mt-5 space-y-4">
              <input type="hidden" name="resumeId" value={resumeId} />

              <label className="block text-sm text-slate-600">
                定制版本名称
                <input
                  name="title"
                  className="mt-2 h-10 w-full rounded-xl border border-line bg-panel px-3.5 text-sm outline-none"
                  placeholder="例如：产品岗基础版-腾讯-AI 产品经理"
                />
              </label>

              <label className="block text-sm text-slate-600">
                关联岗位
                <select
                  name="jobLeadId"
                  className="mt-2 h-10 w-full rounded-xl border border-line bg-panel px-3.5 text-sm outline-none"
                  defaultValue=""
                >
                  <option value="">不关联岗位</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm text-slate-600">
                上传文件
                <input
                  type="file"
                  name="variantFile"
                  required
                  accept=".txt,.md,.pdf,.doc,.docx,image/*"
                  className="mt-2 block w-full rounded-2xl border border-dashed border-line bg-panel px-4 py-3 text-sm outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-ink file:px-3 file:py-2 file:text-white"
                />
              </label>

              <label className="block text-sm text-slate-600">
                备注
                <textarea
                  name="note"
                  rows={5}
                  className="mt-2 w-full rounded-2xl border border-line bg-panel px-3.5 py-3 text-sm leading-6 outline-none"
                  placeholder="例如：根据 AI 建议手动调整了项目经历和求职意向，保留原始模板。"
                />
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
                  保存定制版本
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
