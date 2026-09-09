import fs from "fs/promises";
import { createRequire } from "module";
import path from "path";

async function loadEnvFile(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function isExtractionPlaceholder(text) {
  const value = text?.trim() || "";
  return value.startsWith("【") && value.includes("占位");
}

function chooseResumeAssetSources(assets) {
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

function getPreferredResumeTextSource(assets) {
  const withText = assets.filter((asset) => (asset.extractedText || "").replace(/\s+/g, " ").trim().length > 0);
  if (withText.length === 0) return null;
  const { editingSource, previewSource } = chooseResumeAssetSources(withText);
  return editingSource || previewSource || withText[0] || null;
}

function guessMimeType(fileName) {
  const extension = path.extname(fileName).toLowerCase();
  if (extension === ".pdf") return "application/pdf";
  if (extension === ".doc") return "application/msword";
  if (extension === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if ([".txt", ".md", ".json", ".csv"].includes(extension)) return "text/plain";
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  return "application/octet-stream";
}

async function extractPdfText(bytes, fileName) {
  try {
    const require = createRequire(import.meta.url);
    const { PDFParse } = require("pdf-parse");
    const parser = new PDFParse({ data: bytes });
    const result = await parser.getText();
    await parser.destroy();
    const text = result.text.replace(/\s+\n/g, "\n").trim();
    if (text) return text.slice(0, 16000);
  } catch (error) {
    console.error("extractPdfText failed", { fileName, error });
  }
  return "";
}

async function extractDocxText(bytes, fileName) {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: bytes });
    const text = result.value.replace(/\s+\n/g, "\n").trim();
    if (text) return text.slice(0, 16000);
  } catch (error) {
    console.error("extractDocxText failed", { fileName, error });
  }
  return "";
}

async function extractTextFromBytes({ bytes, fileName, mimeType }) {
  const extension = path.extname(fileName).toLowerCase();
  const isTextLike = mimeType.startsWith("text/") || [".md", ".txt", ".json", ".csv"].includes(extension);
  if (isTextLike) return bytes.toString("utf8").slice(0, 12000).trim();
  if (mimeType.startsWith("image/")) return "";
  if (mimeType.includes("pdf") || extension === ".pdf") return extractPdfText(bytes, fileName);
  if (mimeType.includes("wordprocessingml") || mimeType.includes("msword") || extension === ".docx" || extension === ".doc") {
    return extractDocxText(bytes, fileName);
  }
  return "";
}

async function extractStoredUploadText(input) {
  if (!input.fileUrl) return "";
  try {
    const bytes = input.fileUrl.startsWith("/")
      ? await fs.readFile(path.join(process.cwd(), "public", input.fileUrl))
      : Buffer.from(await (await fetch(input.fileUrl)).arrayBuffer());
    return await extractTextFromBytes({
      bytes,
      fileName: input.originalName || "resume",
      mimeType: input.mimeType || guessMimeType(input.originalName || "resume")
    });
  } catch (error) {
    console.error("extractStoredUploadText failed", { ...input, error });
    return "";
  }
}

async function main() {
  await loadEnvFile(path.join(process.cwd(), ".env.production.local"));

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const resumes = await prisma.resume.findMany({
    include: {
      assets: true
    }
  });

  let updatedAssets = 0;
  let updatedResumes = 0;

  for (const resume of resumes) {
    const hydratedAssets = [];

    for (const asset of resume.assets) {
      let extractedText = asset.extractedText || "";

      if (!extractedText.trim() || isExtractionPlaceholder(extractedText)) {
        extractedText = (
          await extractStoredUploadText({
            fileUrl: asset.fileUrl,
            originalName: asset.artifactName,
            mimeType: asset.artifactMimeType
          })
        ).trim();

        if (extractedText) {
          await prisma.resumeAsset.update({
            where: { id: asset.id },
            data: { extractedText }
          });
          updatedAssets += 1;
        }
      }

      hydratedAssets.push({
        ...asset,
        extractedText
      });
    }

    const preferredText =
      getPreferredResumeTextSource(hydratedAssets)?.extractedText?.trim() ||
      (resume.rawText?.trim() && !isExtractionPlaceholder(resume.rawText) ? resume.rawText.trim() : "");

    if (preferredText && preferredText !== (resume.rawText || "")) {
      await prisma.resume.update({
        where: { id: resume.id },
        data: { rawText: preferredText }
      });
      updatedResumes += 1;
    }
  }

  await prisma.$disconnect();
  console.log(JSON.stringify({ updatedAssets, updatedResumes }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
