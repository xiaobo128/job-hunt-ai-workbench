import "server-only";

export type UserAiSettings = {
  provider?: string | null;
  apiKey?: string | null;
  apiBaseUrl?: string | null;
  forwardHost?: string | null;
  model?: string | null;
  visionModel?: string | null;
};

export type AiSettingsDisplay = {
  hasUserApiKey: boolean;
  hasUserOverrides: boolean;
  usesSiteDefault: boolean;
  isConfigured: boolean;
  provider: string;
  model: string;
  visionModel: string;
  baseUrlHost: string | null;
};

function valueOrEmpty(value?: string | null) {
  return value?.trim() || "";
}

function defaultApiKey() {
  return valueOrEmpty(process.env.DEFAULT_AI_API_KEY) || valueOrEmpty(process.env.OPENAI_API_KEY);
}

function defaultBaseUrl() {
  return valueOrEmpty(process.env.DEFAULT_AI_BASE_URL);
}

function defaultModel() {
  return valueOrEmpty(process.env.DEFAULT_AI_MODEL) || valueOrEmpty(process.env.OPENAI_MODEL) || "gpt-4.1-mini";
}

function defaultVisionModel() {
  return (
    valueOrEmpty(process.env.DEFAULT_AI_VISION_MODEL) ||
    valueOrEmpty(process.env.OPENAI_VISION_MODEL) ||
    defaultModel()
  );
}

export function resolveAiSettings(settings?: UserAiSettings) {
  return {
    provider: valueOrEmpty(settings?.provider) || "openai",
    apiKey: valueOrEmpty(settings?.apiKey) || defaultApiKey(),
    apiBaseUrl: valueOrEmpty(settings?.apiBaseUrl) || defaultBaseUrl(),
    forwardHost: valueOrEmpty(settings?.forwardHost),
    model: valueOrEmpty(settings?.model) || defaultModel(),
    visionModel: valueOrEmpty(settings?.visionModel) || defaultVisionModel()
  };
}

function safeHost(value: string) {
  if (!value) return null;

  try {
    return new URL(value).host || null;
  } catch {
    return null;
  }
}

export function getAiSettingsDisplay(settings?: UserAiSettings): AiSettingsDisplay {
  const effective = resolveAiSettings(settings);
  const hasUserOverrides = Boolean(
    valueOrEmpty(settings?.provider) ||
      valueOrEmpty(settings?.apiKey) ||
      valueOrEmpty(settings?.apiBaseUrl) ||
      valueOrEmpty(settings?.forwardHost) ||
      valueOrEmpty(settings?.model) ||
      valueOrEmpty(settings?.visionModel)
  );

  return {
    hasUserApiKey: Boolean(valueOrEmpty(settings?.apiKey)),
    hasUserOverrides,
    usesSiteDefault: !valueOrEmpty(settings?.apiKey) && Boolean(defaultApiKey()),
    isConfigured: Boolean(effective.apiKey),
    provider: effective.provider,
    model: effective.model,
    visionModel: effective.visionModel,
    baseUrlHost: safeHost(effective.apiBaseUrl)
  };
}
