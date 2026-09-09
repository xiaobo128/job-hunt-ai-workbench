type MonitoringContext = Record<string, unknown>;

type SerializedError = {
  name: string;
  message: string;
  stack?: string;
  digest?: string;
};

const MONITORING_WEBHOOK_URL = process.env.MONITORING_WEBHOOK_URL || "";

function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      digest: "digest" in error ? String((error as { digest?: string }).digest || "") || undefined : undefined
    };
  }

  return {
    name: "UnknownError",
    message: typeof error === "string" ? error : JSON.stringify(error)
  };
}

function createPayload(level: "info" | "error", message: string, context: MonitoringContext = {}, error?: unknown) {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    service: "job-hunt-ai-workbench",
    runtime: process.env.NEXT_RUNTIME || "nodejs",
    context,
    ...(error ? { error: serializeError(error) } : {})
  };
}

export function logInfo(message: string, context: MonitoringContext = {}) {
  console.log(JSON.stringify(createPayload("info", message, context)));
}

export async function reportError(error: unknown, message: string, context: MonitoringContext = {}) {
  const payload = createPayload("error", message, context, error);

  console.error(JSON.stringify(payload));

  if (!MONITORING_WEBHOOK_URL) {
    return;
  }

  try {
    await fetch(MONITORING_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  } catch (webhookError) {
    console.error(
      JSON.stringify(createPayload("error", "monitoring.webhook_failed", { originalMessage: message }, webhookError))
    );
  }
}

export function initMonitoring() {
  const state = globalThis as typeof globalThis & {
    __jobHuntWorkbenchMonitoringReady?: boolean;
  };

  if (state.__jobHuntWorkbenchMonitoringReady) {
    return;
  }

  state.__jobHuntWorkbenchMonitoringReady = true;

  process.on("unhandledRejection", (reason) => {
    void reportError(reason, "process.unhandledRejection");
  });

  process.on("uncaughtException", (error) => {
    void reportError(error, "process.uncaughtException");
  });

  logInfo("monitoring.initialized", {
    hasWebhook: Boolean(MONITORING_WEBHOOK_URL)
  });
}
