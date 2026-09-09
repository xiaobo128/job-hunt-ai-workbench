import path from "path";
import type { ResumeAsset, ResumeAssetKind, ResumeAssetMatchStatus } from "@prisma/client";

type AssetSourceLike = {
  kind: string;
  extractedText: string | null;
};
type AssetLike = AssetSourceLike & Pick<ResumeAsset, "id">;

export function detectResumeAssetKind(fileName: string, mimeType?: string | null): ResumeAssetKind {
  const extension = path.extname(fileName).toLowerCase();
  const normalizedMimeType = mimeType || "";

  if (normalizedMimeType.includes("pdf") || extension === ".pdf") {
    return "PDF";
  }
  if (normalizedMimeType.includes("wordprocessingml") || extension === ".docx") {
    return "DOCX";
  }
  if (normalizedMimeType.includes("msword") || extension === ".doc") {
    return "DOC";
  }
  if (normalizedMimeType.startsWith("image/")) {
    return "IMAGE";
  }
  if (normalizedMimeType.startsWith("text/") || [".txt", ".md", ".json", ".csv"].includes(extension)) {
    return "TEXT";
  }

  return "OTHER";
}

export function chooseResumeAssetSources<T extends AssetSourceLike>(assets: T[]) {
  const editingSource =
    assets.find((asset) => asset.kind === "DOCX") ||
    assets.find((asset) => asset.kind === "DOC") ||
    assets.find((asset) => asset.kind === "TEXT") ||
    assets.find((asset) => asset.kind === "PDF") ||
    assets.find((asset) => asset.kind === "IMAGE") ||
    assets[0] ||
    null;
  const previewSource =
    assets.find((asset) => asset.kind === "PDF") ||
    assets.find((asset) => asset.kind === "IMAGE") ||
    assets.find((asset) => asset.kind === "DOCX") ||
    assets.find((asset) => asset.kind === "DOC") ||
    assets.find((asset) => asset.kind === "TEXT") ||
    assets[0] ||
    null;

  return { editingSource, previewSource };
}

export function evaluateResumeAssetMatchStatus<T extends AssetLike>(
  assets: T[]
): Map<string, ResumeAssetMatchStatus> {
  const result = new Map<string, ResumeAssetMatchStatus>();

  for (const asset of assets) {
    result.set(asset.id, "UNCHECKED");
  }

  const docAsset = assets.find((asset) => asset.kind === "DOCX" || asset.kind === "DOC");
  const pdfAsset = assets.find((asset) => asset.kind === "PDF");

  if (!docAsset || !pdfAsset) {
    return result;
  }

  const docText = normalizeAssetText(docAsset.extractedText);
  const pdfText = normalizeAssetText(pdfAsset.extractedText);

  if (!docText || !pdfText) {
    return result;
  }

  const similarity = calculateDiceCoefficient(docText, pdfText);
  const status: ResumeAssetMatchStatus = similarity >= 0.62 ? "MATCHED" : "POSSIBLE_MISMATCH";

  result.set(docAsset.id, status);
  result.set(pdfAsset.id, status);

  return result;
}

export function getPreferredResumeTextSource<T extends AssetLike>(assets: T[]) {
  const withText = assets.filter((asset) => normalizeResumeText(asset.extractedText).length > 0);

  if (withText.length === 0) {
    return null;
  }

  const { editingSource, previewSource } = chooseResumeAssetSources(withText);
  return (
    (editingSource && normalizeResumeText(editingSource.extractedText) ? editingSource : null) ||
    (previewSource && normalizeResumeText(previewSource.extractedText) ? previewSource : null) ||
    withText[0] ||
    null
  );
}

export function resolveResumeText<T extends AssetSourceLike>(resume: {
  rawText?: string | null;
  assets: T[];
}) {
  const { editingSource } = chooseResumeAssetSources(resume.assets);
  const editingSourceText = normalizeResumeText(editingSource?.extractedText);
  const rawText = normalizeResumeText(resume.rawText);

  if (editingSourceText) {
    return {
      text: editingSourceText,
      source: "editing-source" as const,
      asset: editingSource || null
    };
  }

  if (rawText) {
    return {
      text: rawText,
      source: "resume-rawText" as const,
      asset: null
    };
  }

  return {
    text: "",
    source: "missing" as const,
    asset: null
  };
}

export function getResumeAssetKindLabel(kind: ResumeAssetKind) {
  switch (kind) {
    case "PDF":
      return "PDF";
    case "DOCX":
      return "DOCX";
    case "DOC":
      return "DOC";
    case "IMAGE":
      return "图片";
    case "TEXT":
      return "文本";
    default:
      return "其他";
  }
}

export function getResumeAssetMatchLabel(status: ResumeAssetMatchStatus) {
  switch (status) {
    case "MATCHED":
      return "已匹配";
    case "POSSIBLE_MISMATCH":
      return "可能不一致";
    default:
      return "未校验";
  }
}

function normalizeAssetText(value?: string | null) {
  return (value || "").replace(/\s+/g, " ").trim().slice(0, 12000);
}

function normalizeResumeText(value?: string | null) {
  return (value || "").trim();
}

function calculateDiceCoefficient(left: string, right: string) {
  const leftShingles = buildShingles(left);
  const rightShingles = buildShingles(right);

  if (leftShingles.size === 0 || rightShingles.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const shingle of leftShingles) {
    if (rightShingles.has(shingle)) {
      overlap += 1;
    }
  }

  return (2 * overlap) / (leftShingles.size + rightShingles.size);
}

function buildShingles(input: string) {
  const normalized = input.toLowerCase();
  const shingles = new Set<string>();

  if (normalized.length < 3) {
    if (normalized) {
      shingles.add(normalized);
    }
    return shingles;
  }

  for (let index = 0; index <= normalized.length - 3; index += 1) {
    shingles.add(normalized.slice(index, index + 3));
  }

  return shingles;
}
