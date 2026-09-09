"use client";

import { useFormStatus } from "react-dom";

export function JobDetailSubmitButton({
  idleLabel,
  pendingLabel,
  className
}: {
  idleLabel: string;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button disabled={pending} className={className}>
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
