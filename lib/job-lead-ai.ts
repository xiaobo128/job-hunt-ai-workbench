import { z } from "zod";
import type { UserAiSettings } from "@/lib/ai";

const importedJobSchema = z.object({
  sourceType: z.enum(["LINK", "TEXT", "SCREENSHOT", "MANUAL"]),
  sourceName: z.string().nullable().optional(),
  sourceUrl: z.string().nullable().optional(),
  rawContent: z.string().min(1),
  companyName: z.string().default(""),
  roleTitle: z.string().default(""),
  city: z.string().nullable().optional(),
  seniority: z.string().nullable().optional(),
  salaryRange: z.string().nullable().optional(),
  skills: z.array(z.string()).default([]),
  responsibilities: z.array(z.string()).default([]),
  requirements: z.array(z.string()).default([]),
  parsedSummary: z.string().nullable().optional()
});

type ImportedJob = z.infer<typeof importedJobSchema>;

const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/responses";

function getApiKey(settings?: UserAiSettings) {
  return settings?.apiKey?.trim() || process.env.OPENAI_API_KEY || "";
}

function getForwardHost(settings?: UserAiSettings) {
  return settings?.forwardHost?.trim() || "";
}

function hasOpenAI(settings?: UserAiSettings) {
  return Boolean(getApiKey(settings));
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function resolveResponsesUrl(settings?: UserAiSettings) {
  const configured = (settings?.apiBaseUrl || "").trim();
  const provider = (settings?.provider || "").trim().toLowerCase();

  if (configured) {
    return configured.endsWith("/responses") ? configured : `${configured.replace(/\/$/, "")}/responses`;
  }

  return provider === "openrouter" ? OPENROUTER_API_URL : OPENAI_API_URL;
}

function extractOutputTextFromResponseJson(json: unknown) {
  if (!json || typeof json !== "object") {
    return "";
  }

  const direct = (json as { output_text?: unknown }).output_text;
  if (typeof direct === "string" && direct.trim()) {
    return direct;
  }

  const output = (json as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }).output;
  if (!Array.isArray(output)) {
    return "";
  }

  const textParts = output.flatMap((item) =>
    Array.isArray(item?.content)
      ? item.content
          .filter((part) => part && part.type === "output_text" && typeof part.text === "string")
          .map((part) => part.text as string)
      : []
  );

  return textParts.join("\n").trim();
}

function zodToJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      sourceType: { type: "string", enum: ["LINK", "TEXT", "SCREENSHOT", "MANUAL"] },
      sourceName: { type: ["string", "null"] },
      sourceUrl: { type: ["string", "null"] },
      rawContent: { type: "string" },
      companyName: { type: "string" },
      roleTitle: { type: "string" },
      city: { type: ["string", "null"] },
      seniority: { type: ["string", "null"] },
      salaryRange: { type: ["string", "null"] },
      skills: { type: "array", items: { type: "string" } },
      responsibilities: { type: "array", items: { type: "string" } },
      requirements: { type: "array", items: { type: "string" } },
      parsedSummary: { type: ["string", "null"] }
    },
    required: [
      "sourceType",
      "sourceName",
      "sourceUrl",
      "rawContent",
      "companyName",
      "roleTitle",
      "city",
      "seniority",
      "salaryRange",
      "skills",
      "responsibilities",
      "requirements",
      "parsedSummary"
    ]
  };
}

async function fileToDataUrl(filePath: string, mimeType: string) {
  const { readFile } = await import("fs/promises");
  const bytes = await readFile(filePath);
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

async function createStructuredJobLeadResponse(input: {
  rawContent: string;
  sourceType: "LINK" | "TEXT" | "SCREENSHOT" | "MANUAL";
  sourceName?: string;
  sourceUrl?: string;
  imagePath?: string;
  imageMimeType?: string;
  settings?: UserAiSettings;
}) {
  const apiKey = getApiKey(input.settings);

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing");
  }

  const content: Array<Record<string, string>> = [
    {
      type: "input_text",
      text: `请从下面的岗位信息中提取结构化字段。\n\n来源类型: ${input.sourceType}\n来源名称: ${input.sourceName || "未知"}\n来源链接: ${input.sourceUrl || "无"}\n\n岗位原文:\n${input.rawContent}`
    }
  ];

  if (input.imagePath && input.imageMimeType) {
    content.push({
      type: "input_image",
      image_url: await fileToDataUrl(input.imagePath, input.imageMimeType),
      detail: "high"
    });
  }

  const response = await fetch(resolveResponsesUrl(input.settings), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(getForwardHost(input.settings)
        ? {
            Host: getForwardHost(input.settings),
            "X-Forwarded-Host": getForwardHost(input.settings)
          }
        : {}),
      ...(input.settings?.provider?.toLowerCase() === "openrouter"
        ? {
            "HTTP-Referer": process.env.APP_URL || "http://127.0.0.1:3000",
            "X-Title": "job-hunt-ai-workbench"
          }
        : {})
    },
    body: JSON.stringify({
      model: input.settings?.visionModel?.trim() || input.settings?.model?.trim() || process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "你是一个求职产品里的岗位解析助手。请把岗位描述或招聘截图转换成稳定、简洁、可编辑的结构化 JSON。不要编造看不到的信息，不确定时返回 null 或空数组。"
            }
          ]
        },
        {
          role: "user",
          content
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "job_lead_parse",
          strict: true,
          schema: zodToJsonSchema()
        }
      }
    })
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${bodyText.slice(0, 400)}`);
  }

  const json = (await response.json()) as unknown;
  const raw = extractOutputTextFromResponseJson(json);

  if (!raw) {
    throw new Error(`OpenAI response did not include output_text: ${JSON.stringify(json).slice(0, 400)}`);
  }

  return importedJobSchema.parse(JSON.parse(raw));
}

function extractList(raw: string, seeds: string[]) {
  const hits = seeds.filter((seed) => raw.toLowerCase().includes(seed.toLowerCase()));
  return hits.length > 0 ? hits : seeds.slice(0, 3);
}

function fallbackParseJobLead(
  raw: string,
  input: {
    sourceType: "LINK" | "TEXT" | "SCREENSHOT" | "MANUAL";
    sourceName?: string;
    sourceUrl?: string;
  }
) {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const firstLine = lines[0] ?? "未命名岗位";
  const companyName = firstLine.includes(" - ") ? firstLine.split(" - ")[0] : "待确认公司";
  const roleTitle = firstLine.includes(" - ") ? firstLine.split(" - ")[1] : firstLine;

  return importedJobSchema.parse({
    ...input,
    rawContent: raw,
    companyName,
    roleTitle,
    city: /上海|北京|深圳|杭州|广州/.exec(raw)?.[0] ?? "待确认",
    seniority: /(\d+\s*-\s*\d+\s*年|\d+\+?\s*年)/.exec(raw)?.[0] ?? "不限",
    salaryRange: /(\d+k\s*-\s*\d+k|\d+\s*-\s*\d+\s*k)/i.exec(raw)?.[0],
    skills: extractList(raw, ["SQL", "Python", "产品设计", "数据分析", "Prompt", "项目管理"]),
    responsibilities: lines.slice(1, 4),
    requirements: lines.slice(4, 7),
    parsedSummary: "自动解析结果为基础版，支持用户二次修正。"
  }) as ImportedJob;
}

export async function parseJobLeadDebug(input: {
  sourceType: "LINK" | "TEXT" | "SCREENSHOT" | "MANUAL";
  sourceName?: string;
  sourceUrl?: string;
  rawContent: string;
  imagePath?: string;
  imageMimeType?: string;
  settings?: UserAiSettings;
}) {
  if (hasOpenAI(input.settings)) {
    try {
      const parsed = await createStructuredJobLeadResponse(input);
      const fallback = fallbackParseJobLead(input.rawContent, input);

      return {
        provider: "openai" as const,
        note: "已使用 OpenAI 结构化输出完成岗位解析。",
        data: {
          ...parsed,
          companyName: parsed.companyName?.trim() || fallback.companyName,
          roleTitle: parsed.roleTitle?.trim() || fallback.roleTitle,
          sourceName: parsed.sourceName || input.sourceName || fallback.sourceName,
          sourceUrl: parsed.sourceUrl || input.sourceUrl || fallback.sourceUrl,
          city: parsed.city || fallback.city || undefined,
          seniority: parsed.seniority || fallback.seniority || undefined,
          salaryRange: parsed.salaryRange || fallback.salaryRange || undefined,
          skills: parsed.skills.length > 0 ? parsed.skills : fallback.skills,
          responsibilities: parsed.responsibilities.length > 0 ? parsed.responsibilities : fallback.responsibilities,
          requirements: parsed.requirements.length > 0 ? parsed.requirements : fallback.requirements,
          parsedSummary: parsed.parsedSummary || fallback.parsedSummary || undefined
        } as ImportedJob
      };
    } catch (error) {
      return {
        provider: "local" as const,
        note:
          input.sourceType === "SCREENSHOT"
            ? `OpenAI 图片解析失败，已自动降级到本地规则兜底。错误详情：${getErrorMessage(error)}`
            : `OpenAI 解析失败，已自动降级到本地规则解析。错误详情：${getErrorMessage(error)}`,
        data: fallbackParseJobLead(input.rawContent, input)
      };
    }
  }

  return {
    provider: "local" as const,
    note:
      input.sourceType === "SCREENSHOT"
        ? "未配置 OPENAI_API_KEY，当前使用本地规则兜底。本地模式不会自动 OCR 截图，请手动补充关键岗位信息。"
        : "未配置 OPENAI_API_KEY，当前使用本地规则解析。",
    data: fallbackParseJobLead(input.rawContent, input)
  };
}
