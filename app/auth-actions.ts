"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSession, destroySession, getSessionUser } from "@/lib/session";
import { hashPassword, verifyPassword } from "@/lib/password";

export async function registerUser(formData: FormData) {
  const name = ((formData.get("name") as string | null) ?? "").trim();
  const email = ((formData.get("email") as string | null) ?? "").trim().toLowerCase();
  const password = ((formData.get("password") as string | null) ?? "").trim();

  if (!email || !password || password.length < 6) {
    redirect("/register?error=invalid_input");
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    redirect("/register?error=email_taken");
  }

  const user = await prisma.user.create({
    data: {
      name: name || email.split("@")[0],
      email,
      passwordHash: hashPassword(password)
    }
  });

  await createSession(user.id);
  redirect("/");
}

export async function loginUser(formData: FormData) {
  const email = ((formData.get("email") as string | null) ?? "").trim().toLowerCase();
  const password = ((formData.get("password") as string | null) ?? "").trim();

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    redirect("/login?error=invalid_credentials");
  }

  await createSession(user.id);
  redirect("/");
}

export async function logoutUser() {
  await destroySession();
  redirect("/login");
}

export async function redirectIfLoggedIn() {
  const user = await getSessionUser();

  if (user) {
    redirect("/");
  }
}
