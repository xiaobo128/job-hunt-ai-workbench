import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma, withDbRetry } from "@/lib/db";

const SESSION_COOKIE = "job_workbench_session";
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 14;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS);

  await withDbRetry("createSession", () =>
    prisma.session.create({
      data: {
        userId,
        tokenHash,
        expiresAt
      }
    })
  );

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await withDbRetry("destroySession", () =>
      prisma.session.deleteMany({
        where: { tokenHash: sha256(token) }
      })
    );
  }

  cookieStore.delete(SESSION_COOKIE);
}

export const getSessionUser = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const session = await withDbRetry("getSessionUser", () =>
    prisma.session.findFirst({
      where: {
        tokenHash: sha256(token),
        expiresAt: { gt: new Date() }
      },
      include: {
        user: true
      }
    })
  );

  if (!session) {
    return null;
  }

  return session.user;
});

export async function requireSessionUser() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
