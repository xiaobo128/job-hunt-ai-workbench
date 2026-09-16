"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function OriginalEmailDialog({
  title,
  recordedAt,
  content,
}: {
  title: string;
  recordedAt: string;
  content: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-2xl border border-line px-4 py-2 text-sm font-medium text-ink">
        查看全文
      </button>
      {open
        ? createPortal(
            <div className="fixed inset-0 z-[100] bg-slate-950/30 p-4 backdrop-blur-sm sm:p-6" role="presentation" onClick={() => setOpen(false)}>
              <div className="flex min-h-full items-center justify-center">
                <section role="dialog" aria-modal="true" aria-labelledby="original-email-title" className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-card sm:max-h-[calc(100vh-3rem)]" onClick={(event) => event.stopPropagation()}>
                  <header className="flex items-start justify-between gap-4 border-b border-line p-5">
                    <div className="min-w-0">
                      <div className="text-sm text-slate-500">原始邮件</div>
                      <h2 id="original-email-title" className="mt-1 truncate text-lg font-semibold text-ink">{title}</h2>
                      <p className="mt-1 text-sm text-slate-500">记录时间：{recordedAt}</p>
                    </div>
                    <button type="button" onClick={() => setOpen(false)} aria-label="关闭" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-line text-xl leading-none text-slate-500">×</button>
                  </header>
                  <div className="overflow-y-auto p-5">
                    {content ? <div className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{linkify(content)}</div> : <p className="text-sm text-slate-500">未保存原始邮件正文。</p>}
                  </div>
                </section>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

function linkify(content: string) {
  return content.split(/(https?:\/\/[^\s<>"']+)/g).map((part, index) =>
    part.startsWith("http://") || part.startsWith("https://") ? <a key={`${part}-${index}`} href={part} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-4">{part}</a> : part
  );
}
