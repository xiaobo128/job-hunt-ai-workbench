"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useFormStatus } from "react-dom";
import { createNotificationEvent } from "@/app/actions";

type NotificationApplicationOption = {
  id: string;
  label: string;
};

export function AddNotificationDialog({
  applications
}: {
  applications: NotificationApplicationOption[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-white"
      >
        导入通知
      </button>

      {open
        ? createPortal(
            <div className="fixed inset-0 z-[100] bg-slate-950/30 p-4 backdrop-blur-sm sm:p-6">
              <div className="flex min-h-full items-center justify-center">
                <div className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-line bg-white p-5 shadow-card sm:max-h-[calc(100vh-3rem)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-lg font-semibold text-ink">导入通知</div>
                      <p className="mt-1 text-sm text-slate-500">
                        粘贴邮件正文、OCR 文本或聊天内容，再关联到对应岗位。
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      aria-label="关闭"
                      className="flex h-10 w-10 items-center justify-center rounded-2xl border border-line text-xl leading-none text-slate-500"
                    >
                      ×
                    </button>
                  </div>

                  <form action={createNotificationEvent} className="mt-5 space-y-4">
                    <label className="block text-sm text-slate-600">
                      关联申请
                      <select
                        name="applicationId"
                        className="mt-2 w-full rounded-2xl border border-line bg-panel px-4 py-3 outline-none"
                      >
                        {applications.map((application) => (
                          <option key={application.id} value={application.id}>
                            {application.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block text-sm text-slate-600">
                      附件
                      <input
                        type="file"
                        name="attachment"
                        accept=".txt,.md,.pdf,image/*"
                        className="mt-2 block w-full rounded-2xl border border-dashed border-line bg-panel px-4 py-3 text-sm outline-none file:mr-3 file:rounded-xl file:border-0 file:bg-ink file:px-3 file:py-2 file:text-white"
                      />
                    </label>

                    <label className="block text-sm text-slate-600">
                      通知内容
                      <textarea
                        name="content"
                        rows={12}
                        className="mt-2 w-full rounded-3xl border border-line bg-panel px-4 py-3 outline-none"
                        placeholder="例如：请于 2026-04-26 19:00 参加面试，并提前准备作品集。"
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
                      <SubmitButton />
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

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      disabled={pending}
      className="rounded-2xl bg-ink px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "正在解析并导入..." : "导入通知"}
    </button>
  );
}
