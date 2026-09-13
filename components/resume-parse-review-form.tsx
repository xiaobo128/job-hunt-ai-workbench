"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  confirmResumeParseReview,
  saveResumeParseReview,
  type ResumeParseConfirmState,
  type ResumeParseReviewSaveState
} from "@/app/actions";
import type { ResumeDocument } from "@/lib/resume-parsing/core";

const initialSaveState: ResumeParseReviewSaveState = {};
const initialConfirmState: ResumeParseConfirmState = {};

export function ResumeParseReviewForm({
  resumeId,
  parseId,
  status,
  document: initialDocument
}: {
  resumeId: string;
  parseId: string;
  status: "NEEDS_REVIEW" | "CONFIRMED" | "SUPERSEDED";
  document: ResumeDocument;
}) {
  const router = useRouter();
  const [document, setDocument] = useState(initialDocument);
  const [saveState, saveFormAction, savePending] = useActionState(saveResumeParseReview, initialSaveState);
  const [confirmState, confirmFormAction, confirmPending] = useActionState(confirmResumeParseReview, initialConfirmState);
  const editable = status === "NEEDS_REVIEW";

  useEffect(() => {
    if (saveState.saved) router.refresh();
  }, [router, saveState.saved]);

  useEffect(() => {
    if (confirmState.confirmed) router.refresh();
  }, [confirmState.confirmed, router]);

  const updateBasics = (field: keyof ResumeDocument["basics"], value: string) => {
    setDocument((current) => ({
      ...current,
      basics: { ...current.basics, [field]: value.trim() ? value : null }
    }));
  };

  const updateSection = (sectionIndex: number, update: Partial<ResumeDocument["sections"][number]>) => {
    setDocument((current) => ({
      ...current,
      sections: current.sections.map((section, index) => (index === sectionIndex ? { ...section, ...update } : section))
    }));
  };

  const updateItem = (
    sectionIndex: number,
    itemIndex: number,
    update: Partial<ResumeDocument["sections"][number]["items"][number]>
  ) => {
    setDocument((current) => ({
      ...current,
      sections: current.sections.map((section, currentSectionIndex) =>
        currentSectionIndex !== sectionIndex
          ? section
          : {
              ...section,
              items: section.items.map((item, currentItemIndex) =>
                currentItemIndex === itemIndex ? { ...item, ...update } : item
              )
            }
      )
    }));
  };

  return (
    <div className="space-y-5 rounded-3xl border border-line bg-white p-4 shadow-card">
      <div>
        <h2 className="font-semibold text-ink">结构化字段</h2>
        <p className="mt-1 text-sm text-slate-500">
          {editable ? "可直接修改提取结果；保存和确认时服务端都会再次校验完整数据。" : "该版本已经锁定，字段不可修改。"}
        </p>
      </div>

      <form id="resume-parse-review-save" action={saveFormAction} className="contents">
        <input type="hidden" name="resumeId" value={resumeId} />
        <input type="hidden" name="parseId" value={parseId} />
        <input type="hidden" name="documentJson" value={JSON.stringify(document)} />

        <fieldset className="grid gap-3 rounded-2xl bg-panel p-3 sm:grid-cols-3">
          <Field disabled={!editable} label="姓名" value={document.basics.name ?? ""} onChange={(value) => updateBasics("name", value)} />
          <Field disabled={!editable} label="电话" value={document.basics.phone ?? ""} onChange={(value) => updateBasics("phone", value)} />
          <Field disabled={!editable} label="邮箱" value={document.basics.email ?? ""} onChange={(value) => updateBasics("email", value)} />
        </fieldset>

        {document.sections.map((section, sectionIndex) => (
          <section key={section.id} className="space-y-3 rounded-2xl border border-line p-3">
            <Field disabled={!editable} label="分区标题" value={section.title} onChange={(value) => updateSection(sectionIndex, { title: value })} />
            {section.items.map((item, itemIndex) => (
              <div key={item.id} className="space-y-3 rounded-xl bg-panel p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field disabled={!editable} label="标题" required value={item.heading} onChange={(value) => updateItem(sectionIndex, itemIndex, { heading: value })} />
                  <Field disabled={!editable} label="副标题" value={item.subheading ?? ""} onChange={(value) => updateItem(sectionIndex, itemIndex, { subheading: value || null })} />
                  <Field disabled={!editable} label="开始时间" value={item.startDate ?? ""} onChange={(value) => updateItem(sectionIndex, itemIndex, { startDate: value || null })} />
                  <Field disabled={!editable} label="结束时间" value={item.endDate ?? ""} onChange={(value) => updateItem(sectionIndex, itemIndex, { endDate: value || null })} />
                </div>
                <label className="block text-xs font-medium text-slate-600">
                  内容要点（每行一条）
                  <textarea
                    disabled={!editable}
                    value={item.bullets.map((bullet) => bullet.text).join("\n")}
                    onChange={(event) =>
                      updateItem(sectionIndex, itemIndex, {
                        bullets: event.target.value
                          .split("\n")
                          .map((text, index) => ({ id: item.bullets[index]?.id ?? crypto.randomUUID(), text: text.trim() }))
                          .filter((bullet) => bullet.text)
                      })
                    }
                    rows={Math.max(3, item.bullets.length + 1)}
                    className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm leading-6 outline-none"
                  />
                </label>
              </div>
            ))}
          </section>
        ))}

        {saveState.error ? <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{saveState.error}</p> : null}
        {saveState.saved ? <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">已保存，状态仍为待结构化确认。</p> : null}
        {editable ? (
          <button disabled={savePending} className="inline-flex h-10 items-center justify-center rounded-xl bg-ink px-4 text-sm font-medium text-white disabled:opacity-60">
            {savePending ? "保存中…" : "保存结构化字段"}
          </button>
        ) : null}
      </form>

      {editable ? (
        <form action={confirmFormAction} className="space-y-3 border-t border-line pt-5">
          <input type="hidden" name="parseId" value={parseId} />
          <p className="text-sm text-slate-500">确认只会使用最近一次已保存的数据。若刚修改过字段，请先保存。</p>
          {confirmState.error ? <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{confirmState.error}</p> : null}
          <button disabled={confirmPending || savePending} className="inline-flex h-10 items-center justify-center rounded-xl bg-accent px-4 text-sm font-medium text-white disabled:opacity-60">
            {confirmPending ? "确认中…" : "确认结构化简历"}
          </button>
        </form>
      ) : (
        <p role="status" className="rounded-xl bg-panel px-3 py-2 text-sm text-slate-600">
          {status === "CONFIRMED" ? "此版本当前已确认。" : "此版本已被更新的确认版本替代。"}
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required = false,
  disabled = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      <input
        disabled={disabled}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none"
      />
    </label>
  );
}
