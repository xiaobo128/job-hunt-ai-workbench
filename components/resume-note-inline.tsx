"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateResumeNote } from "@/app/actions";

export function ResumeNoteInline({
  resumeId,
  initialNote
}: {
  resumeId: string;
  initialNote: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(initialNote ?? "");
  const [draft, setDraft] = useState(initialNote ?? "");
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(draft.length, draft.length);
    }
  }, [editing, draft]);

  const finishEditing = () => {
    const current = note.trim();
    const next = draft.trim();

    if (current === next) {
      setEditing(false);
      return;
    }

    const confirmed = window.confirm("确认保存这条备注修改吗？");

    if (!confirmed) {
      setDraft(note);
      setEditing(false);
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("resumeId", resumeId);
      formData.set("note", draft);
      await updateResumeNote(formData);
      setNote(draft);
      setEditing(false);
      router.refresh();
    });
  };

  if (editing) {
    return (
      <textarea
        ref={textareaRef}
        value={draft}
        rows={2}
        disabled={isPending}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={finishEditing}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            finishEditing();
          }

          if (event.key === "Escape") {
            event.preventDefault();
            setDraft(note);
            setEditing(false);
          }
        }}
        className="min-h-[56px] w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm leading-6 outline-none"
        placeholder="例如：这个版本突出 AI 项目经历，没有展开运营项目，主要用于 AI 产品和策略岗位。"
      />
    );
  }

  return (
    <button
      type="button"
      onDoubleClick={() => setEditing(true)}
      className="block w-full rounded-2xl px-1 py-1 text-left text-sm leading-6 text-slate-600"
      title="双击修改备注"
    >
      {note.trim() ? (
        <span className="block truncate">{note.trim()}</span>
      ) : (
        <span className="text-slate-400">双击填写这版简历的备注</span>
      )}
    </button>
  );
}
