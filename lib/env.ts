const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || "local";
const APP_URL = process.env.APP_URL || "";
const DATABASE_URL = process.env.DATABASE_URL || "";

export function getRuntimeConfig() {
  const usesPostgres = DATABASE_URL.startsWith("postgresql://");
  const usesSqlite = DATABASE_URL.startsWith("file:");
  const usesHttpsAppUrl = APP_URL.startsWith("https://");
  const usesLocalAppUrl = APP_URL.startsWith("http://localhost");
  const hasOpenAi = Boolean(process.env.DEFAULT_AI_API_KEY || process.env.OPENAI_API_KEY);
  const hasBlobToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  const hasResumeBlobToken = Boolean(process.env.RESUME_BLOB_READ_WRITE_TOKEN);
  const hasResumeBlobStoreId = Boolean(process.env.RESUME_BLOB_STORE_ID);

  return {
    appUrl: APP_URL || null,
    database: {
      provider: usesPostgres ? "postgresql" : usesSqlite ? "sqlite" : "unknown",
      isProductionReady: usesPostgres
    },
    storage: {
      provider: STORAGE_PROVIDER,
      isProductionReady:
        STORAGE_PROVIDER === "vercel-blob"
          ? hasBlobToken && hasResumeBlobToken && hasResumeBlobStoreId
          : STORAGE_PROVIDER !== "local"
    },
    ai: {
      hasOpenAi,
      model: process.env.DEFAULT_AI_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini",
      visionModel:
        process.env.DEFAULT_AI_VISION_MODEL ||
        process.env.OPENAI_VISION_MODEL ||
        process.env.DEFAULT_AI_MODEL ||
        process.env.OPENAI_MODEL ||
        "gpt-4.1-mini"
    },
    deployment: {
      usesHttpsAppUrl,
      usesLocalAppUrl,
      readyForProduction:
        usesPostgres &&
        usesHttpsAppUrl &&
        ((STORAGE_PROVIDER === "vercel-blob" && hasBlobToken && hasResumeBlobToken && hasResumeBlobStoreId) ||
          STORAGE_PROVIDER !== "local")
    }
  };
}
