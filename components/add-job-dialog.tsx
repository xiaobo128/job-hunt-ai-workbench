"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFormStatus } from "react-dom";
import { createJobLead } from "@/app/actions";

function inferSourceType(files: File[], sourceUrl: string, rawContent: string) {
  if (files.some((file) => file.type.startsWith("image/"))) {
    return "SCREENSHOT";
  }

  if (sourceUrl.trim()) {
    return rawContent.trim() ? "TEXT" : "LINK";
  }

  if (rawContent.trim()) {
    return "TEXT";
  }

  return "MANUAL";
}

export function AddJobDialog() {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [sourceUrl, setSourceUrl] = useState("");
  const [rawContent, setRawContent] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const sourceType = useMemo(() => inferSourceType(files, sourceUrl, rawContent), [files, sourceUrl, rawContent]);

  useEffect(() => {
    if (!fileInputRef.current) {
      return;
    }

    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    fileInputRef.current.files = transfer.files;
  }, [files]);

  function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const imageItems = Array.from(event.clipboardData.items).filter((item) => item.type.startsWith("image/"));

    if (imageItems.length === 0) {
      return;
    }

    event.preventDefault();

    const nextFiles = imageItems
      .map((item, index) => {
        const pastedFile = item.getAsFile();

        if (!pastedFile) {
          return null;
        }

        return new File([pastedFile], pastedFile.name || `clipboard-${Date.now()}-${index + 1}.png`, {
          type: pastedFile.type || "image/png"
        });
      })
      .filter((file): file is File => Boolean(file));

    if (nextFiles.length === 0) {
      return;
    }

    setFiles((current) => [...current, ...nextFiles]);
  }

  function removeFile(indexToRemove: number) {
    setFiles((current) => current.filter((_, index) => index !== indexToRemove));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center justify-center rounded-xl bg-ink px-4 text-sm font-medium text-white"
      >
        导入岗位
      </button>

      {open
        ? createPortal(
            <div className="fixed inset-0 z-[100] bg-slate-950/30 p-4 backdrop-blur-sm sm:p-6">
              <div className="flex min-h-full items-center justify-center">
                <div className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-line bg-white p-5 shadow-card sm:max-h-[calc(100vh-3rem)]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="text-lg font-semibold text-ink">导入岗位</div>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      aria-label="关闭"
                      className="flex h-10 w-10 items-center justify-center rounded-2xl border border-line text-xl leading-none text-slate-500"
                    >
                      ×
                    </button>
                  </div>

                  <form action={createJobLead} className="mt-5 space-y-4" encType="multipart/form-data">
                    <input type="hidden" name="sourceType" value={sourceType} />
                    <input
                      ref={fileInputRef}
                      type="file"
                      name="artifact"
                      multiple
                      className="hidden"
                      tabIndex={-1}
                      aria-hidden="true"
                    />

                    <label className="block text-sm text-slate-600">
                      岗位名称
                      <input
                        name="manualRoleTitle"
                        className="mt-2 h-10 w-full rounded-xl border border-line bg-panel px-3.5 text-sm outline-none"
                        placeholder="可手动输入，也可以留空让系统解析后自动生成"
                      />
                    </label>

                    <label className="block text-sm text-slate-600">
                      来源备注
                      <input
                        name="sourceName"
                        className="mt-2 h-10 w-full rounded-xl border border-line bg-panel px-3.5 text-sm outline-none"
                        placeholder="例如：BOSS 直聘 / 官网 / 朋友转发 / 小红书"
                      />
                    </label>

                    <label className="block text-sm text-slate-600">
                      参考链接
                      <input
                        name="sourceUrl"
                        value={sourceUrl}
                        onChange={(event) => setSourceUrl(event.target.value)}
                        className="mt-2 h-10 w-full rounded-xl border border-line bg-panel px-3.5 text-sm outline-none"
                        placeholder="https://..."
                      />
                      <span className="mt-2 block text-xs text-slate-400">
                        链接用于回看来源；请同时粘贴岗位正文或补充关键信息。
                      </span>
                    </label>

                    <label className="block text-sm text-slate-600">
                      岗位正文或备注
                      <textarea
                        name="rawContent"
                        rows={10}
                        value={rawContent}
                        onChange={(event) => setRawContent(event.target.value)}
                        onPaste={handlePaste}
                        placeholder="直接粘贴岗位正文；也支持在这里粘贴截图。没有正文时，也可以先写你的判断、岗位亮点或链接补充说明。"
                        className="mt-2 w-full rounded-2xl border border-line bg-panel px-3.5 py-3 text-sm leading-6 outline-none"
                      />
                      <span className="mt-2 block text-xs text-slate-400">
                        这个输入区同时支持文字和截图粘贴，你可以连续粘贴多张图片。
                      </span>
                    </label>

                    {files.length > 0 ? (
                      <div className="space-y-2">
                        <div className="text-sm text-slate-600">已粘贴图片</div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {files.map((file, index) => (
                            <PastedImageCard key={`${file.name}-${index}`} file={file} index={index} onRemove={removeFile} />
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-line px-4 text-sm font-medium text-ink"
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
      className="inline-flex h-10 items-center justify-center rounded-xl bg-ink px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "正在识别并生成..." : "生成岗位卡片"}
    </button>
  );
}

function PastedImageCard({
  file,
  index,
  onRemove
}: {
  file: File;
  index: number;
  onRemove: (index: number) => void;
}) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    const nextUrl = URL.createObjectURL(file);
    setUrl(nextUrl);

    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  return (
    <div className="rounded-2xl border border-line bg-panel p-3">
      <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-white">
        {url ? <img src={url} alt={file.name} className="h-full w-full object-cover" /> : null}
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="min-w-0 text-xs text-slate-500">{file.name}</div>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="shrink-0 rounded-xl border border-line px-2 py-1 text-xs text-slate-500"
        >
          删除
        </button>
      </div>
    </div>
  );
}
