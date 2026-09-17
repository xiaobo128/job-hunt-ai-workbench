"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveAndConfirmResumeParseReview, type ResumeParseConfirmState } from "@/app/actions";
import type { ResumeDocument } from "@/lib/resume-parsing/core";

const initialConfirmState: ResumeParseConfirmState = {};
const reviewFormId = "resume-parse-review";

export function ResumeParseReviewActions({ editable }: { editable: boolean }) {
  return <div className="flex flex-wrap items-center gap-2">
    <a href="/resumes" className="inline-flex h-10 items-center justify-center rounded-xl border border-line bg-white px-4 text-sm font-medium text-ink">返回简历仓库</a>
    {editable ? <button form={reviewFormId} type="submit" className="inline-flex h-10 items-center justify-center rounded-xl bg-accent px-4 text-sm font-medium text-white">保存并确认</button> : null}
  </div>;
}

export function ResumeParseReviewForm({ resumeId, parseId, status, document: initialDocument }: { resumeId: string; parseId: string; status: "NEEDS_REVIEW" | "CONFIRMED" | "SUPERSEDED"; document: ResumeDocument }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [document, setDocument] = useState(initialDocument);
  const [confirmState, confirmFormAction, confirmPending] = useActionState(saveAndConfirmResumeParseReview, initialConfirmState);
  const editable = status === "NEEDS_REVIEW";

  useEffect(() => { if (confirmState.confirmed) router.refresh(); }, [confirmState.confirmed, router]);

  const updateBasics = (field: keyof ResumeDocument["basics"], value: string) => setDocument((current) => ({ ...current, basics: { ...current.basics, [field]: value.trim() ? value : null } }));
  const updateSection = (sectionIndex: number, update: Partial<ResumeDocument["sections"][number]>) => setDocument((current) => ({ ...current, sections: current.sections.map((section, index) => index === sectionIndex ? { ...section, ...update } : section) }));
  const updateItem = (sectionIndex: number, itemIndex: number, update: Partial<ResumeDocument["sections"][number]["items"][number]>) => setDocument((current) => ({ ...current, sections: current.sections.map((section, currentSectionIndex) => currentSectionIndex !== sectionIndex ? section : { ...section, items: section.items.map((item, currentItemIndex) => currentItemIndex === itemIndex ? { ...item, ...update } : item) }) }));

  return <div className="space-y-5 rounded-3xl border border-line bg-white p-4 shadow-card">
    <div className="xl:sticky xl:top-0 xl:z-10 xl:-mx-4 xl:-mt-4 xl:bg-white xl:px-4 xl:pb-4 xl:pt-4">
      <h2 className="font-semibold text-ink">简历信息</h2>
      <p className="mt-1 text-sm text-slate-500">{editable ? "系统已解析简历内容，请核对后确认；右上角“保存并确认”会保存全部信息。" : "该版本已经锁定，信息不可修改。"}</p>
    </div>
    <form ref={formRef} id={reviewFormId} action={confirmFormAction} className="contents">
      <input type="hidden" name="resumeId" value={resumeId} />
      <input type="hidden" name="parseId" value={parseId} />
      <input type="hidden" name="documentJson" value={JSON.stringify(document)} />
      <fieldset className="grid gap-3 rounded-2xl bg-panel p-3 sm:grid-cols-3">
        <Field disabled={!editable} label="姓名" value={document.basics.name ?? ""} onChange={(value) => updateBasics("name", value)} />
        <Field disabled={!editable} label="电话" value={document.basics.phone ?? ""} onChange={(value) => updateBasics("phone", value)} />
        <Field disabled={!editable} label="邮箱" value={document.basics.email ?? ""} onChange={(value) => updateBasics("email", value)} />
      </fieldset>
      {document.sections.map((section, sectionIndex) => <section key={section.id} className="space-y-3 rounded-2xl border border-line p-3">
        <Field disabled={!editable} label="分区标题" value={section.title} onChange={(value) => updateSection(sectionIndex, { title: value })} />
        {section.items.map((item, itemIndex) => <div key={item.id} className="space-y-3 rounded-xl bg-panel p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field disabled={!editable} label="标题" required value={item.heading} onChange={(value) => updateItem(sectionIndex, itemIndex, { heading: value })} />
            <Field disabled={!editable} label="副标题" value={item.subheading ?? ""} onChange={(value) => updateItem(sectionIndex, itemIndex, { subheading: value || null })} />
            <Field disabled={!editable} label="开始时间" value={item.startDate ?? ""} onChange={(value) => updateItem(sectionIndex, itemIndex, { startDate: value || null })} />
            <Field disabled={!editable} label="结束时间" value={item.endDate ?? ""} onChange={(value) => updateItem(sectionIndex, itemIndex, { endDate: value || null })} />
          </div>
          <label className="block text-xs font-medium text-slate-600">内容要点（每行一条）
            <textarea disabled={!editable} value={item.bullets.map((bullet) => bullet.text).join("\n")} onChange={(event) => updateItem(sectionIndex, itemIndex, { bullets: event.target.value.split("\n").map((text, index) => ({ id: item.bullets[index]?.id ?? crypto.randomUUID(), text: text.trim() })).filter((bullet) => bullet.text) })} rows={Math.max(3, item.bullets.length + 1)} className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm leading-6 outline-none" />
          </label>
        </div>)}
      </section>)}
      {confirmState.error ? <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{confirmState.error}</p> : null}
      {confirmPending ? <p role="status" className="rounded-xl bg-panel px-3 py-2 text-sm text-slate-600">正在保存并确认…</p> : null}
      {!editable ? <p role="status" className="rounded-xl bg-panel px-3 py-2 text-sm text-slate-600">{status === "CONFIRMED" ? "此版本当前已确认。" : "此版本已被更新的确认版本替代。"}</p> : null}
    </form>
    {editable ? <ResumeReviewLeaveGuard formRef={formRef} submit={confirmFormAction} pending={confirmPending} error={confirmState.error} confirmed={Boolean(confirmState.confirmed)} /> : null}
  </div>;
}

function ResumeReviewLeaveGuard({ formRef, submit, pending, error, confirmed }: { formRef: React.RefObject<HTMLFormElement | null>; submit: (formData: FormData) => void; pending: boolean; error?: string; confirmed: boolean }) {
  const router = useRouter();
  const [destination, setDestination] = useState<string | "back" | null>(null);
  const bypassBackRef = useRef(false);
  useEffect(() => {
    if (!destination || !confirmed) return;
    if (destination === "back") { bypassBackRef.current = true; window.history.back(); } else router.push(destination);
  }, [confirmed, destination, router]);
  useEffect(() => {
    if (confirmed) return;
    window.history.pushState({ resumeReviewGuard: true }, "", window.location.href);
    const onBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const onPopState = () => { if (!bypassBackRef.current) { window.history.go(1); setDestination("back"); } };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname || url.pathname.startsWith("/api/")) return;
      event.preventDefault(); setDestination(`${url.pathname}${url.search}${url.hash}`);
    };
    window.addEventListener("beforeunload", onBeforeUnload); window.addEventListener("popstate", onPopState); document.addEventListener("click", onClick, true);
    return () => { window.removeEventListener("beforeunload", onBeforeUnload); window.removeEventListener("popstate", onPopState); document.removeEventListener("click", onClick, true); };
  }, [confirmed]);
  if (!destination) return null;
  return <div role="dialog" aria-modal="true" aria-labelledby="resume-review-leave-title" className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm">
    <div className="w-full max-w-md rounded-3xl border border-line bg-white p-5 shadow-card">
      <h2 id="resume-review-leave-title" className="text-lg font-semibold text-ink">这份简历还没有完成确认</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">请确认简历信息与原简历一致。未确认的解析结果不会作为最终候选人资料使用。</p>
      {error ? <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <button type="button" disabled={pending} onClick={() => setDestination(null)} className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-ink">继续检查</button>
        <button type="button" disabled={pending} onClick={() => { if (formRef.current) submit(new FormData(formRef.current)); }} className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">{pending ? "保存并确认中…" : "确认无误并离开"}</button>
      </div>
    </div>
  </div>;
}

function Field({ label, value, onChange, required = false, disabled = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; disabled?: boolean }) {
  return <label className="block text-xs font-medium text-slate-600">{label}<input disabled={disabled} required={required} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none" /></label>;
}
