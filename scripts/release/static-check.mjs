import fs from "fs";
import path from "path";

const root = process.cwd();
let failed = false;

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function pass(message) {
  console.log(`[OK] ${message}`);
}

function fail(message) {
  failed = true;
  console.error(`[FAIL] ${message}`);
}

function requireText(relativePath, pattern, message) {
  const contents = read(relativePath);
  if (pattern.test(contents)) pass(message);
  else fail(message);
}

function forbidText(relativePath, pattern, message) {
  const contents = read(relativePath);
  if (pattern.test(contents)) fail(message);
  else pass(message);
}

for (const relativePath of [
  "prisma/schema.postgres.prisma",
  "prisma/migrations/migration_lock.toml",
  "prisma/migrations/20260911000000_baseline/migration.sql",
  "prisma/migrations/20260911000001_add_resume_parse/migration.sql",
  "app/api/health/route.ts",
  "app/api/resumes/[id]/download/route.ts",
  "app/api/resume-assets/[id]/download/route.ts",
  "app/api/resume-variants/[id]/download/route.ts",
  "lib/storage.ts",
  "vercel.json"
]) {
  if (fs.existsSync(path.join(root, relativePath))) pass(`${relativePath} exists`);
  else fail(`${relativePath} is missing`);
}

requireText("prisma/schema.postgres.prisma", /provider\s*=\s*"postgresql"/, "PostgreSQL schema is selected");
requireText("prisma/migrations/migration_lock.toml", /provider\s*=\s*"postgresql"/, "migration lock targets PostgreSQL");
requireText("app/api/health/route.ts", /SELECT 1/, "health endpoint probes the database");

for (const relativePath of [
  "app/api/resumes/[id]/download/route.ts",
  "app/api/resume-assets/[id]/download/route.ts",
  "app/api/resume-variants/[id]/download/route.ts"
]) {
  requireText(relativePath, /if \(!user\)[\s\S]{0,120}status:\s*401/, `${relativePath} rejects anonymous download`);
  requireText(relativePath, /ownerId:\s*user\.id/, `${relativePath} scopes lookup to the owner`);
  requireText(relativePath, /Cache-Control":\s*"private, no-store"/, `${relativePath} marks responses private`);
}

requireText("lib/storage.ts", /PRIVATE_RESUME_FOLDERS[\s\S]{0,160}"resumes"[\s\S]{0,80}"resume-variants"/, "resume folders are designated private");
requireText("lib/storage.ts", /access:\s*isPrivateResumeUpload\s*\?\s*"private"\s*:\s*"public"/, "resume Blob writes request private access");
requireText("lib/storage.ts", /access:\s*"private"/, "private Blob reads require private access");
requireText("vercel.json", /prisma:generate:postgres/, "Vercel build generates the PostgreSQL Prisma client");
forbidText("vercel.json", /migrate\s+(deploy|dev)|db\s+push/, "Vercel build does not mutate schema");

process.exitCode = failed ? 1 : 0;
