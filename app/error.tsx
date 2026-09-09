"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function RootError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    console.error(error);

    const payload = JSON.stringify({
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      pathname,
      source: "app/error"
    });

    void fetch("/api/monitoring/client-error", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: payload
    }).catch(() => undefined);
  }, [error, pathname]);

  const looksLikeDatabaseOutage =
    error.message.includes("P1001") ||
    error.message.includes("Can't reach database server") ||
    error.message.includes("terminating connection due to administrator command");

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-6 py-20">
      <div className="rounded-3xl border border-line bg-white p-8 shadow-card">
        <div className="text-sm uppercase tracking-[0.22em] text-slate-400">Service Status</div>
        <h1 className="mt-3 text-3xl font-semibold text-ink">
          {looksLikeDatabaseOutage ? "Database Connection Is Temporarily Unavailable" : "Something Went Wrong"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {looksLikeDatabaseOutage
            ? "The workspace could not reach the database just now. This is usually temporary. Please retry in a moment."
            : "The page hit an unexpected problem. You can retry now, and if it keeps happening we can inspect the logs."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={() => reset()} className="rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-white">
            Retry
          </button>
          <a href="/jobs" className="rounded-2xl border border-line px-4 py-3 text-sm font-medium text-ink">
            Back To Jobs
          </a>
        </div>
      </div>
    </div>
  );
}
