import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";

export type StorageUploadInput = {
  bytes: Buffer;
  originalName: string;
  folder: string;
  contentType?: string;
};

export type StorageUploadResult = {
  fileUrl: string;
  absolutePath: string;
};

const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || "local";
const PRIVATE_RESUME_FOLDERS = new Set(["resumes", "resume-variants"]);

function getResumeBlobConfig() {
  const token = process.env.RESUME_BLOB_READ_WRITE_TOKEN?.trim();
  const storeId = process.env.RESUME_BLOB_STORE_ID?.trim();

  if (!token || !storeId) {
    throw new Error(
      "RESUME_BLOB_READ_WRITE_TOKEN and RESUME_BLOB_STORE_ID are required for private resume storage"
    );
  }

  return { token, storeId };
}

function isPrivateBlobUrl(fileUrl: string) {
  try {
    return new URL(fileUrl).hostname.endsWith(".private.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export async function saveUpload({
  bytes,
  originalName,
  folder,
  contentType
}: StorageUploadInput): Promise<StorageUploadResult> {
  const extension = path.extname(originalName) || ".bin";
  const fileName = `${Date.now()}-${randomUUID()}${extension}`;
  const tempDir = path.join(tmpdir(), "job-hunt-ai-workbench", "uploads", folder);
  const absolutePath = path.join(tempDir, fileName);

  await mkdir(tempDir, { recursive: true });
  await writeFile(absolutePath, bytes);

  if (STORAGE_PROVIDER === "local") {
    const uploadDir = path.join(process.cwd(), "public", "uploads", folder);
    const publicPath = path.join(uploadDir, fileName);

    await mkdir(uploadDir, { recursive: true });
    await writeFile(publicPath, bytes);

    return {
      fileUrl: `/uploads/${folder}/${fileName}`,
      absolutePath
    };
  }

  if (STORAGE_PROVIDER === "vercel-blob") {
    const isPrivateResumeUpload = PRIVATE_RESUME_FOLDERS.has(folder);
    const resumeBlob = isPrivateResumeUpload ? getResumeBlobConfig() : null;
    const token = resumeBlob?.token || process.env.BLOB_READ_WRITE_TOKEN;

    if (!token) {
      throw new Error("BLOB_READ_WRITE_TOKEN is required when STORAGE_PROVIDER=vercel-blob");
    }

    const blob = await put(`uploads/${folder}/${fileName}`, bytes, {
      access: isPrivateResumeUpload ? "private" : "public",
      addRandomSuffix: false,
      contentType: contentType || "application/octet-stream",
      token
    });

    return {
      fileUrl: blob.url,
      absolutePath
    };
  }

  throw new Error(`Unsupported storage provider: ${STORAGE_PROVIDER}`);
}

export async function readStoredFileBytes(fileUrl: string): Promise<Buffer> {
  if (!fileUrl) {
    throw new Error("A stored file URL is required.");
  }

  if (fileUrl.startsWith("/")) {
    return readFile(path.join(process.cwd(), "public", fileUrl));
  }

  if (isPrivateBlobUrl(fileUrl)) {
    const { token } = getResumeBlobConfig();
    const result = await get(fileUrl, {
      access: "private",
      token
    });

    if (!result || result.statusCode !== 200 || !result.stream) {
      throw new Error("Could not read private resume blob.");
    }

    return Buffer.from(await new Response(result.stream).arrayBuffer());
  }

  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Could not read stored file (${response.status}).`);
  }

  return Buffer.from(await response.arrayBuffer());
}
