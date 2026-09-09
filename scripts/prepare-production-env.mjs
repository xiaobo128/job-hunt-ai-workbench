import fs from "fs";
import path from "path";

const cwd = process.cwd();
const sourcePath = path.join(cwd, ".env.neon.example");
const targetPath = path.join(cwd, ".env.production.local");

if (!fs.existsSync(sourcePath)) {
  console.error("[FAIL] .env.neon.example was not found");
  process.exit(1);
}

if (fs.existsSync(targetPath)) {
  console.log("[WARN] .env.production.local already exists");
  console.log(`[OK] Keep editing: ${targetPath}`);
  process.exit(0);
}

fs.copyFileSync(sourcePath, targetPath);

console.log("[OK] Created .env.production.local from .env.neon.example");
console.log(`[OK] Edit this file with your Neon, Vercel Blob, and OpenAI credentials: ${targetPath}`);
