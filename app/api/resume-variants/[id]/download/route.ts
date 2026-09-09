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
  const variant = await prisma.resumeVariant.findFirst({
    where: {
      id,
      resume: { ownerId: user.id }
    }
  });

  if (!variant?.fileUrl) {
    return new Response("Not Found", { status: 404 });
  }

  try {
    const bytes = variant.fileUrl.startsWith("/")
      ? await readFile(path.join(process.cwd(), "public", variant.fileUrl))
      : Buffer.from(await (await fetch(variant.fileUrl)).arrayBuffer());

    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": variant.artifactMimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
          variant.artifactName || `${variant.title}.bin`
        )}`
      }
    });
  } catch {
    return new Response("Failed to read file", { status: 500 });
  }
}
