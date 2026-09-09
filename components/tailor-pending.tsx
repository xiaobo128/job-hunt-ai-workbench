"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

type PendingButtonProps = {
  idleText: string;
  pendingText: string;
  className: string;
  formAction?: (formData: FormData) => void | Promise<void>;
  name?: string;
  value?: string;
};

export function TailorPendingButton({
  idleText,
  pendingText,
  className,
  formAction,
  name,
  value
}: PendingButtonProps) {
  const { pending } = useFormStatus();
  const [clicked, setClicked] = useState(false);
  const active = clicked;

  useEffect(() => {
    if (!pending) {
      const timer = window.setTimeout(() => {
        setClicked(false);
      }, 150);

      return () => window.clearTimeout(timer);
    }
  }, [pending]);

  useEffect(() => {
    if (!clicked) {
      return;
    }

    const timer = window.setTimeout(() => {
      setClicked(false);
    }, 15000);

    return () => window.clearTimeout(timer);
  }, [clicked]);

  return (
    <button
      type="submit"
      formAction={formAction}
      name={name}
      value={value}
      disabled={pending}
      onClick={() => setClicked(true)}
      className={`inline-flex h-10 items-center justify-center whitespace-nowrap rounded-xl px-4 text-sm font-medium ${className} ${
        pending ? "cursor-wait opacity-70" : ""
      }`}
    >
      {active ? pendingText : idleText}
    </button>
  );
}

export function TailorPendingNotice({ text }: { text: string }) {
  const { pending } = useFormStatus();

  if (!pending) {
    return null;
  }

  return <div className="rounded-xl bg-panel px-4 py-2.5 text-sm text-slate-600">{text}</div>;
}
