"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AutoDownloadVariant({ variantId }: { variantId?: string }) {
  const router = useRouter();

  useEffect(() => {
    if (!variantId) {
      return;
    }

    const link = document.createElement("a");
    link.href = `/api/resume-variants/${variantId}/download`;
    link.download = "";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();

    const timer = window.setTimeout(() => {
      router.replace("/tailor", { scroll: false });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      link.remove();
    };
  }, [router, variantId]);

  if (!variantId) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
      新版本已归档，浏览器正在开始下载导出的文件。
    </div>
  );
}
