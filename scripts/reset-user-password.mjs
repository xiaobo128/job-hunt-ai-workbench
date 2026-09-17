import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const MINIMUM_PASSWORD_LENGTH = 6;
const KEYLEN = 64;

class UserNotFoundError extends Error {
  constructor(email) {
    super("User not found");
    this.email = email;
  }
}

loadLocalEnvironment();

const email = readEmailArgument();
const prisma = new PrismaClient();

try {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true }
  });

  if (!user) {
    throw new UserNotFoundError(email);
  }

  const password = await readPassword();

  if (password.length < MINIMUM_PASSWORD_LENGTH) {
    fail(`Password must be at least ${MINIMUM_PASSWORD_LENGTH} characters long.`);
  }

  // Keep this in lockstep with lib/password.ts, which is used by registration.
  const passwordHash = hashPassword(password);
  const updatedCount = await prisma.$executeRaw`
    UPDATE "User"
    SET "passwordHash" = ${passwordHash}
    WHERE "id" = ${user.id}
  `;

  if (updatedCount !== 1) {
    fail("Password reset did not update exactly one user.");
  }

  console.log(`Password reset successfully for ${email}.`);
} catch (error) {
  if (error instanceof UserNotFoundError) {
    console.error(`No user found for email: ${error.email}`);
    process.exitCode = 1;
  } else {
    console.error("Password reset failed.");
    if (process.env.NODE_ENV !== "production" && error instanceof Error) {
      console.error(error.message);
    }
    process.exitCode = 1;
  }
} finally {
  await prisma.$disconnect();
}

function hashPassword(value) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(value, salt, KEYLEN).toString("hex");
  return `${salt}:${derived}`;
}

function readEmailArgument() {
  const args = process.argv.slice(2);
  const emailIndex = args.indexOf("--email");
  const email = emailIndex === -1 ? "" : args[emailIndex + 1]?.trim().toLowerCase();

  if (!email || args.length !== 2 || args[0] !== "--email") {
    fail("Usage: node scripts/reset-user-password.mjs --email user@example.com");
  }

  return email;
}

function readPassword() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    fail("Run this script from an interactive terminal so the password is not exposed.");
  }

  return new Promise((resolve) => {
    let value = "";
    process.stdout.write("New password: ");
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    process.stdin.on("data", (key) => {
      if (key === "\u0003") {
        process.stdout.write("\n");
        process.exit(130);
      }

      if (key === "\r" || key === "\n") {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdout.write("\n");
        resolve(value);
        return;
      }

      if (key === "\u007f" || key === "\b") {
        value = value.slice(0, -1);
        return;
      }

      if (key >= " ") {
        value += key;
      }
    });
  });
}

function loadLocalEnvironment() {
  const environment = process.env;

  for (const fileName of [".env.production.local", ".env.local", ".env"]) {
    const filePath = path.join(process.cwd(), fileName);

    if (!fs.existsSync(filePath)) {
      continue;
    }

    for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      const separator = trimmed.indexOf("=");

      if (!trimmed || trimmed.startsWith("#") || separator === -1) {
        continue;
      }

      const key = trimmed.slice(0, separator).trim();
      const rawValue = trimmed.slice(separator + 1).trim();

      if (!(key in environment)) {
        environment[key] = rawValue.replace(/^['"]|['"]$/g, "");
      }
    }
  }
}

function fail(message) {
  throw new Error(message);
}
