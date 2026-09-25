import dns from "node:dns/promises";
import process from "node:process";

import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
const production = process.argv.includes("--production");

loadEnvConfig(process.cwd(), !production);

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

let parsedUrl;

try {
  parsedUrl = new URL(databaseUrl);
} catch {
  console.error("DATABASE_URL is not a valid URL. Its value was not printed.");
  process.exit(1);
}

const { PrismaClient } = await import("@prisma/client");

console.log("Database connection configuration:", {
  environment: production ? "production" : "development",
  protocol: parsedUrl.protocol,
  host: parsedUrl.hostname,
  port: parsedUrl.port || "5432",
  database: parsedUrl.pathname.replace(/^\/+/, ""),
  passwordSet: Boolean(parsedUrl.password),
  parameters: [...parsedUrl.searchParams.keys()].sort()
});

try {
  const addresses = await dns.lookup(parsedUrl.hostname, { all: true });
  console.log(
    "Resolved addresses:",
    addresses.map(({ address, family }) => ({ address, family: `IPv${family}` }))
  );
} catch (error) {
  console.error("DNS lookup failed:", error instanceof Error ? error.message : String(error));
}

const prisma = new PrismaClient();

try {
  const result = await prisma.$queryRaw`SELECT 1 AS ok`;
  console.log("SELECT 1 succeeded:", result);
} catch (error) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
  console.error(`SELECT 1 failed (${code}). Database credentials were not printed.`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
