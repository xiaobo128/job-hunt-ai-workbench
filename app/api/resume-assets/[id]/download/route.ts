import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { readStoredFileBytes } from "@/lib/storage";

export async function GET(
  request: Request,
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
    const bytes = await readStoredFileBytes(asset.fileUrl);

    const disposition = new URL(request.url).searchParams.get("disposition") === "inline" ? "inline" : "attachment";
    return new Response(Uint8Array.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": asset.artifactMimeType || "application/octet-stream",
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(asset.artifactName || "resume-asset.bin")}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return new Response("Failed to read file", { status: 500 });
  }
}
