"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function GlobalError({
  error
}: {
  error: Error & { digest?: string };
}) {
  const pathname = usePathname();

  useEffect(() => {
    console.error(error);

    const payload = JSON.stringify({
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      pathname,
      source: "app/global-error"
    });

    void fetch("/api/monitoring/client-error", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: payload
    }).catch(() => undefined);
  }, [error, pathname]);

  return (
    <html lang="zh-CN">
      <body>
        <div className="mx-auto max-w-3xl space-y-4 px-6 py-20">
          <div className="rounded-3xl border border-line bg-white p-8 shadow-card">
            <div className="text-sm uppercase tracking-[0.22em] text-slate-400">Service Status</div>
            <h1 className="mt-3 text-3xl font-semibold text-ink">The App Hit A Critical Error</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Please refresh the page. If the problem continues, check the deployment logs or database connectivity.
            </p>
            <div className="mt-6">
              <a href="/jobs" className="rounded-2xl border border-line px-4 py-3 text-sm font-medium text-ink">
                Back To Jobs
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
