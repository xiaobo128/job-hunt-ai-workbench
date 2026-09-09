import path from "path";
import { readFile } from "fs/promises";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await context.params;
  const asset = await prisma.resumeAsset.findFirst({
    where: {
      id,
      resume: { ownerId: user.id }
    }
  });

  if (!asset?.fileUrl) {
    return new Response("Not Found", { status: 404 });
  }

  try {
    const bytes = asset.fileUrl.startsWith("/")
      ? await readFile(path.join(process.cwd(), "public", asset.fileUrl))
      : Buffer.from(await (await fetch(asset.fileUrl)).arrayBuffer());

    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": asset.artifactMimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(asset.artifactName || "resume-asset.bin")}`
      }
    });
  } catch {
    return new Response("Failed to read file", { status: 500 });
  }
}
