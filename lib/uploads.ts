import path from "path";
import { readFile } from "fs/promises";
import type { UserAiSettings } from "@/lib/ai";
import { normalizeResumeExtraction } from "@/lib/ai";
import { saveUpload } from "@/lib/storage";

type UploadKind = "job-leads" | "notifications" | "resumes" | "resume-variants";

export function isExtractionPlaceholder(text?: string | null) {
  const value = text?.trim() || "";
  return value.startsWith("【") && value.includes("占位");
}

export async function persistUpload(
  file: File,
  kind: UploadKind,
  options?: { extractText?: boolean; settings?: UserAiSettings }
) {
  if (!file || file.size === 0) {
    return null;
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const stored = await saveUpload({
    bytes,
    originalName: file.name,
    folder: kind,
    contentType: file.type || guessMimeType(file.name)
  });

  return {
    originalName: file.name,
    mimeType: file.type || guessMimeType(file.name),
    fileUrl: stored.fileUrl,
    absolutePath: stored.absolutePath,
    extractedText: options?.extractText === false ? "" : await extractText(file, bytes, options?.settings)
  };
}

export async function extractStoredUploadText(input: {
  fileUrl?: string | null;
  originalName?: string | null;
  mimeType?: string | null;
  settings?: UserAiSettings;
}) {
  if (!input.fileUrl) {
    return "";
  }

  try {
    const bytes = input.fileUrl.startsWith("/")
      ? await readFile(path.join(process.cwd(), "public", input.fileUrl))
      : Buffer.from(await (await fetch(input.fileUrl)).arrayBuffer());

    const text = await extractTextFromBytes({
      bytes,
      fileName: input.originalName || "resume",
      mimeType: input.mimeType || guessMimeType(input.originalName || "resume"),
      settings: input.settings
    });

    return isExtractionPlaceholder(text) ? "" : text;
  } catch (error) {
    console.error("extractStoredUploadText failed", {
      fileUrl: input.fileUrl,
      originalName: input.originalName,
      mimeType: input.mimeType,
      error
    });
    return "";
  }
}

async function extractText(file: File, bytes: Buffer, settings?: UserAiSettings) {
  return extractTextFromBytes({
    bytes,
    fileName: file.name,
    mimeType: file.type || guessMimeType(file.name),
    settings
  });
}

async function extractTextFromBytes({
  bytes,
  fileName,
  mimeType,
  settings
}: {
  bytes: Buffer;
  fileName: string;
  mimeType: string;
  settings?: UserAiSettings;
}) {
  const extension = path.extname(fileName).toLowerCase();
  const isTextLike = mimeType.startsWith("text/") || [".md", ".txt", ".json", ".csv"].includes(extension);

  if (isTextLike) {
    return bytes.toString("utf8").slice(0, 12000).trim();
  }

  if (mimeType.startsWith("image/")) {
    return `【OCR 占位】已上传图片文件 ${fileName}。当前版本会先保存原文件，建议补充截图中的关键岗位或通知文字，以便完成结构化解析。`;
  }

  if (mimeType.includes("pdf") || extension === ".pdf") {
    return extractPdfText(bytes, fileName);
  }

  if (
    mimeType.includes("wordprocessingml") ||
    mimeType.includes("msword") ||
    extension === ".docx" ||
    extension === ".doc"
  ) {
    return extractDocxTextWithLayout(bytes, fileName, settings);
  }

  return `【文件已上传】${fileName}。当前版本暂未自动抽取该文件格式的正文，请补充关键文字。`;
}

function guessMimeType(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();

  if (extension === ".pdf") return "application/pdf";
  if (extension === ".doc") return "application/msword";
  if (extension === ".docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if ([".txt", ".md", ".json", ".csv"].includes(extension)) return "text/plain";
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";

  return "application/octet-stream";
}

async function extractPdfText(bytes: Buffer, fileName: string) {
  try {
    const canvasModule = (0, eval)("require")("@napi-rs/canvas") as Partial<{
      DOMMatrix: typeof globalThis.DOMMatrix;
      ImageData: typeof globalThis.ImageData;
      Path2D: typeof globalThis.Path2D;
    }>;

    if (canvasModule.DOMMatrix && !globalThis.DOMMatrix) {
      globalThis.DOMMatrix = canvasModule.DOMMatrix;
    }

    if (canvasModule.ImageData && !globalThis.ImageData) {
      globalThis.ImageData = canvasModule.ImageData;
    }

    if (canvasModule.Path2D && !globalThis.Path2D) {
      globalThis.Path2D = canvasModule.Path2D;
    }

    const { PDFParse } = (0, eval)("require")("pdf-parse") as {
      PDFParse: new (input: { data: Buffer }) => {
        getText: () => Promise<{ text: string }>;
        destroy: () => Promise<void>;
      };
    };
    const parser = new PDFParse({ data: bytes });
    const result = await parser.getText();
    await parser.destroy();
    const text = result.text.replace(/\s+\n/g, "\n").trim();

    if (text) {
      return text.slice(0, 16000);
    }
  } catch (error) {
    console.error("extractPdfText failed", { fileName, error });
  }

  return `【PDF 抽取占位】已上传 PDF 文件 ${fileName}。当前版本保留了原文件，但这次未成功提取正文，建议补充关键文字。`;
}

async function extractDocxText(bytes: Buffer, fileName: string) {
  try {
    const mammoth = (await import("mammoth")) as unknown as {
      extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string }>;
    };
    const result = await mammoth.extractRawText({ buffer: bytes });
    const text = result.value.replace(/\s+\n/g, "\n").trim();

    if (text) {
      return text.slice(0, 16000);
    }
  } catch (error) {
    console.error("extractDocxText failed", { fileName, error });
  }

  return `【Word 抽取占位】已上传 Word 文件 ${fileName}。当前版本保留了原文件，但这次未成功提取正文，建议稍后在微调时重试，或补充版本备注。`;
}

async function extractDocxTextWithLayout(bytes: Buffer, fileName: string, settings?: UserAiSettings) {
  try {
    const mammoth = (await import("mammoth")) as unknown as {
      extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string }>;
      convertToHtml: (input: { buffer: Buffer }) => Promise<{ value: string }>;
    };
    const [rawResult, htmlResult] = await Promise.all([
      mammoth.extractRawText({ buffer: bytes }),
      mammoth.convertToHtml({ buffer: bytes })
    ]);
    const nativeText = rawResult.value.replace(/\s+\n/g, "\n").trim();
    const layoutText = htmlToText(htmlResult.value).replace(/\s+\n/g, "\n").trim();

    if (nativeText && layoutText && shouldNormalizeDocxText(nativeText, layoutText)) {
      const normalized = await normalizeResumeExtraction({
        fileName,
        nativeText,
        layoutText,
        settings
      });
      const normalizedText = normalized.data.extractedText.trim();

      if (normalizedText) {
        return normalizedText.slice(0, 16000);
      }
    }

    const preferredText = layoutText || nativeText;

    if (preferredText) {
      return preferredText.slice(0, 16000);
    }
  } catch (error) {
    console.error("extractDocxTextWithLayout failed", { fileName, error });
  }

  return extractDocxText(bytes, fileName);
}

function htmlToText(html: string) {
  return html
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|tr|table|ul|ol)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<td\b[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function shouldNormalizeDocxText(nativeText: string, layoutText: string) {
  const normalizedNative = normalizeComparisonText(nativeText);
  const normalizedLayout = normalizeComparisonText(layoutText);

  if (!normalizedNative || !normalizedLayout || normalizedNative === normalizedLayout) {
    return false;
  }

  const nativeHead = normalizedNative.slice(0, 200);
  const nativeTail = normalizedNative.slice(-200);
  const layoutHead = normalizedLayout.slice(0, 200);

  if (layoutHead && nativeTail && nativeTail.includes(layoutHead.slice(0, 80))) {
    return true;
  }

  return nativeHead.slice(0, 120) !== layoutHead.slice(0, 120);
}

function normalizeComparisonText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
