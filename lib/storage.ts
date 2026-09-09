import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { put } from "@vercel/blob";

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
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error("BLOB_READ_WRITE_TOKEN is required when STORAGE_PROVIDER=vercel-blob");
    }

    const blob = await put(`uploads/${folder}/${fileName}`, bytes, {
      access: "public",
      addRandomSuffix: false,
      contentType: contentType || "application/octet-stream",
      token: process.env.BLOB_READ_WRITE_TOKEN
    });

    return {
      fileUrl: blob.url,
      absolutePath
    };
  }

  throw new Error(`Unsupported storage provider: ${STORAGE_PROVIDER}`);
}
