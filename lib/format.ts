export function formatDate(value?: string | Date | null) {
  if (!value) return "未设置";

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function safeJsonArray(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function listToMultiline(value: string) {
  return safeJsonArray(value).join("\n");
}

export function multilineToJson(value: string) {
  return JSON.stringify(
    value
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean)
  );
}
