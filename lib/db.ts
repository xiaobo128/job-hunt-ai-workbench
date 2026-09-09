import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

function isTransientPrismaConnectionError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? String(error.code) : "";
  const message = error instanceof Error ? error.message : String(error);

  return (
    code === "P1001" ||
    message.includes("Can't reach database server") ||
    message.includes("terminating connection due to administrator command")
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withDbRetry<T>(operation: string, run: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;

      if (!isTransientPrismaConnectionError(error) || attempt === maxRetries) {
        throw error;
      }

      console.warn(`[db-retry] ${operation} failed on attempt ${attempt + 1}. Retrying...`);
      await wait(300 * (attempt + 1));
    }
  }

  throw lastError;
}
