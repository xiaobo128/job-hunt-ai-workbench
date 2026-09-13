import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { readStoredFileBytes } from "@/lib/storage";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await context.params;
  const resume = await prisma.resume.findFirst({
    where: {
      id,
      ownerId: user.id
    }
  });

  if (!resume?.fileUrl) {
    return new Response("Not Found", { status: 404 });
  }

  try {
    const bytes = await readStoredFileBytes(resume.fileUrl);

    return new Response(Uint8Array.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": resume.artifactMimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
          resume.artifactName || `${resume.title}.bin`
        )}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return new Response("Failed to read file", { status: 500 });
  }
}
