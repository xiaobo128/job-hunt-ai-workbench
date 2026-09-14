import fs from "fs";
import path from "path";

const required = ["DATABASE_URL", "APP_URL", "STORAGE_PROVIDER"];
const optional = ["OPENAI_API_KEY", "OPENAI_MODEL", "OPENAI_VISION_MODEL"];

let hasError = false;
const cwd = process.cwd();
const envFiles = [".env.production.local", ".env.local", ".env"];
const env = loadEnv();

function ok(message) {
  console.log(`[OK] ${message}`);
}

function warn(message) {
  console.log(`[WARN] ${message}`);
}

function fail(message) {
  hasError = true;
  console.log(`[FAIL] ${message}`);
}

for (const key of required) {
  if (env[key] && !isPlaceholderValue(key, env[key])) {
    ok(`${key} is configured`);
  } else {
    fail(`${key} is missing`);
  }
}

const databaseUrl = env.DATABASE_URL || "";
if (isPlaceholderValue("DATABASE_URL", databaseUrl)) {
  fail("DATABASE_URL is still using a placeholder value");
} else if (databaseUrl.startsWith("postgresql://")) {
  ok("DATABASE_URL looks like PostgreSQL");
} else if (databaseUrl.startsWith("file:")) {
  warn("DATABASE_URL still points to SQLite; this is not production-ready");
} else if (databaseUrl) {
  warn("DATABASE_URL is set but does not match the expected PostgreSQL format");
}

const appUrl = env.APP_URL || "";
if (isPlaceholderValue("APP_URL", appUrl)) {
  fail("APP_URL is still using a placeholder value");
} else if (appUrl.startsWith("https://")) {
  ok("APP_URL uses HTTPS");
} else if (appUrl.startsWith("http://localhost")) {
  warn("APP_URL is still localhost; switch it before production deployment");
} else if (appUrl) {
  warn("APP_URL is set but not using HTTPS");
}

const storageProvider = env.STORAGE_PROVIDER || "";
if (storageProvider === "local") {
  warn("STORAGE_PROVIDER is local; switch to vercel-blob or another object storage provider before production");
} else if (storageProvider === "vercel-blob") {
  ok("STORAGE_PROVIDER is vercel-blob");
  if (env.BLOB_READ_WRITE_TOKEN && !isPlaceholderValue("BLOB_READ_WRITE_TOKEN", env.BLOB_READ_WRITE_TOKEN)) {
    ok("BLOB_READ_WRITE_TOKEN is configured");
  } else {
    fail("BLOB_READ_WRITE_TOKEN is missing");
  }
  if (
    env.RESUME_BLOB_READ_WRITE_TOKEN &&
    !isPlaceholderValue("RESUME_BLOB_READ_WRITE_TOKEN", env.RESUME_BLOB_READ_WRITE_TOKEN)
  ) {
    ok("RESUME_BLOB_READ_WRITE_TOKEN is configured");
  } else {
    fail("RESUME_BLOB_READ_WRITE_TOKEN is missing");
  }
  if (env.RESUME_BLOB_STORE_ID && !isPlaceholderValue("RESUME_BLOB_STORE_ID", env.RESUME_BLOB_STORE_ID)) {
    ok("RESUME_BLOB_STORE_ID is configured");
  } else {
    fail("RESUME_BLOB_STORE_ID is missing");
  }
} else if (storageProvider) {
  warn("STORAGE_PROVIDER is set to a non-standard provider; verify that the configured provider is supported");
}

for (const key of optional) {
  if (env[key] && !isPlaceholderValue(key, env[key])) {
    ok(`${key} is configured`);
  } else {
    warn(`${key} is not set; AI features will use fallback behavior`);
  }
}

if (hasError) {
  process.exit(1);
}

function loadEnv() {
  const merged = { ...process.env };

  for (const fileName of envFiles) {
    const filePath = path.join(cwd, fileName);

    if (!fs.existsSync(filePath)) {
      continue;
    }

    let content = "";

    try {
      content = fs.readFileSync(filePath, "utf8");
    } catch (error) {
      warn(`Could not read ${fileName}; continuing with remaining env sources`);
      continue;
    }

    const lines = content.split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");

      if (separatorIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const rawValue = trimmed.slice(separatorIndex + 1).trim();
      const value = rawValue.replace(/^['"]|['"]$/g, "");

      if (!(key in merged)) {
        merged[key] = value;
      }
    }
  }

  return merged;
}

function isPlaceholderValue(key, value) {
  const normalized = String(value).trim();

  if (!normalized) {
    return true;
  }

  const placeholderPatterns = [
    "your-domain.com",
    "USER:PASSWORD",
    "ep-example",
    "vercel_blob_rw_...",
    "sk-..."
  ];

  if (placeholderPatterns.some((pattern) => normalized.includes(pattern))) {
    return true;
  }

  if (key === "APP_URL" && normalized === "https://your-domain.com") {
    return true;
  }

  return false;
}
