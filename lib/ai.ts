import { readFile } from "fs/promises";
import { z } from "zod";

const importedJobSchema = z.object({
  sourceType: z.enum(["LINK", "TEXT", "SCREENSHOT", "MANUAL"]),
  sourceName: z.string().nullable().optional(),
  sourceUrl: z.string().nullable().optional(),
  rawContent: z.string().min(1, "请输入岗位内容"),
  companyName: z.string().min(1),
  roleTitle: z.string().min(1),
  city: z.string().nullable().optional(),
  seniority: z.string().nullable().optional(),
  salaryRange: z.string().nullable().optional(),
  skills: z.array(z.string()).default([]),
  responsibilities: z.array(z.string()).default([]),
  requirements: z.array(z.string()).default([]),
  parsedSummary: z.string().nullable().optional()
});

type ImportedJob = z.infer<typeof importedJobSchema>;
type AIProvider = "openai" | "local";
export type UserAiSettings = {
  provider?: string | null;
  apiKey?: string | null;
  apiBaseUrl?: string | null;
  forwardHost?: string | null;
  model?: string | null;
  visionModel?: string | null;
};
type AIResult<T> = {
  provider: AIProvider;
  note: string;
  data: T;
};

const tailorAnalysisSchema = z.object({
  summary: z.string(),
  jdAnalysis: z
    .object({
      coreResponsibilities: z.array(z.string()).default([]),
      mustHaves: z.array(z.string()).default([]),
      bonusSignals: z.array(z.string()).default([]),
      hiddenPreferences: z.array(z.string()).default([]),
      atsKeywords: z.array(z.string()).default([]),
      businessContext: z.string().default("")
    })
    .default({
      coreResponsibilities: [],
      mustHaves: [],
      bonusSignals: [],
      hiddenPreferences: [],
      atsKeywords: [],
      businessContext: ""
    }),
  resumeAnalysis: z
    .object({
      preservedSections: z.array(z.string()).default([]),
      evidenceUnits: z.array(z.string()).default([]),
      strongEvidence: z.array(z.string()).default([]),
      weakEvidence: z.array(z.string()).default([])
    })
    .default({
      preservedSections: [],
      evidenceUnits: [],
      strongEvidence: [],
      weakEvidence: []
    }),
  alignment: z
    .object({
      strengths: z.array(z.string()).default([]),
      gaps: z.array(z.string()).default([]),
      priorities: z.array(z.string()).default([])
    })
    .default({
      strengths: [],
      gaps: [],
      priorities: []
    }),
  validation: z
    .object({
      unsupportedClaims: z.array(z.string()).default([]),
      overfitRisks: z.array(z.string()).default([]),
      toneRisks: z.array(z.string()).default([]),
      followUps: z.array(z.string()).default([])
    })
    .default({
      unsupportedClaims: [],
      overfitRisks: [],
      toneRisks: [],
      followUps: []
    })
});

const tailorDraftSchema = z.object({
  summary: z.string(),
  draftTitle: z.string(),
  draftText: z.string()
});

const notificationSchema = z.object({
  eventType: z.enum(["NOTE", "ASSESSMENT", "INTERVIEW", "OFFER", "REJECTION", "DEADLINE"]),
  eventTime: z.string().nullable(),
  requirements: z.array(z.string()).default([]),
  summary: z.string()
});

const resumeExtractSchema = z.object({
  extractedText: z.string()
});

const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/responses";
const OPENAI_REQUEST_TIMEOUT_MS = 45000;

function resolveResponsesUrl(settings?: UserAiSettings) {
  const configured = (settings?.apiBaseUrl || "").trim();
  const provider = (settings?.provider || "").trim().toLowerCase();

  if (configured) {
    return configured.endsWith("/responses") ? configured : `${configured.replace(/\/$/, "")}/responses`;
  }

  return provider === "openrouter" ? OPENROUTER_API_URL : OPENAI_API_URL;
}

function getApiKey(settings?: UserAiSettings) {
  return settings?.apiKey?.trim() || process.env.OPENAI_API_KEY || "";
}

function hasOpenAI(settings?: UserAiSettings) {
  return Boolean(getApiKey(settings));
}

function getTextModel(settings?: UserAiSettings) {
  return settings?.model?.trim() || process.env.OPENAI_MODEL || "gpt-4.1-mini";
}

function getVisionModel(settings?: UserAiSettings) {
  return settings?.visionModel?.trim() || process.env.OPENAI_VISION_MODEL || getTextModel(settings);
}

function getForwardHost(settings?: UserAiSettings) {
  return settings?.forwardHost?.trim() || "";
}

function createRequestTimeoutSignal(timeoutMs: number) {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(timeoutMs);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  controller.signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
  return controller.signal;
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

function extractFirstJsonValue(text: string) {
  const source = text.trim();

  if (!source) {
    return "";
  }

  const startIndex = [...source].findIndex((char) => char === "{" || char === "[");
  if (startIndex < 0) {
    return source;
  }

  const opening = source[startIndex];
  const closing = opening === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === "\"") {
        inString = false;
      }

      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === opening) {
      depth += 1;
      continue;
    }

    if (char === closing) {
      depth -= 1;
      if (depth === 0) {
        return source.slice(startIndex, index + 1);
      }
    }
  }

  return source.slice(startIndex);
}

function parseStructuredJsonText(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(extractFirstJsonValue(raw));
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function extractList(raw: string, seeds: string[]) {
  const hits = seeds.filter((seed) => raw.toLowerCase().includes(seed.toLowerCase()));
  return hits.length > 0 ? hits : seeds.slice(0, 3);
}

async function fileToDataUrl(filePath: string, mimeType: string) {
  const bytes = await readFile(filePath);
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

async function createStructuredResponse<T>({
  schema,
  schemaName,
  systemPrompt,
  userPrompt,
  imagePath,
  imageMimeType,
  model,
  settings
}: {
  schema: z.ZodSchema<T>;
  schemaName: string;
  systemPrompt: string;
  userPrompt: string;
  imagePath?: string;
  imageMimeType?: string;
  model?: string;
  settings?: UserAiSettings;
}) {
  const apiKey = getApiKey(settings);

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing");
  }

  const content: Array<Record<string, string>> = [{ type: "input_text", text: userPrompt }];

  if (imagePath && imageMimeType) {
    content.push({
      type: "input_image",
      image_url: await fileToDataUrl(imagePath, imageMimeType),
      detail: "high"
    });
  }

  const response = await fetch(resolveResponsesUrl(settings), {
    method: "POST",
    signal: createRequestTimeoutSignal(OPENAI_REQUEST_TIMEOUT_MS),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(getForwardHost(settings)
        ? {
            Host: getForwardHost(settings),
            "X-Forwarded-Host": getForwardHost(settings)
          }
        : {}),
      ...(settings?.provider?.toLowerCase() === "openrouter"
        ? {
            "HTTP-Referer": process.env.APP_URL || "http://127.0.0.1:3000",
            "X-Title": "job-hunt-ai-workbench"
          }
        : {})
    },
    body: JSON.stringify({
      model: imagePath ? getVisionModel(settings) : model || getTextModel(settings),
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemPrompt }]
        },
        {
          role: "user",
          content
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: schemaName,
          strict: true,
          schema: zodToJsonSchema(schemaName)
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

  return schema.parse(parseStructuredJsonText(raw));
}

function zodToJsonSchema(name: string) {
  if (name === "job_lead_parse") {
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

  if (name === "resume_tailor_advice") {
    return {
      type: "object",
      additionalProperties: false,
      properties: {
        summary: { type: "string" },
        jdAnalysis: {
          type: "object",
          additionalProperties: false,
          properties: {
            coreResponsibilities: { type: "array", items: { type: "string" } },
            mustHaves: { type: "array", items: { type: "string" } },
            bonusSignals: { type: "array", items: { type: "string" } },
            hiddenPreferences: { type: "array", items: { type: "string" } },
            atsKeywords: { type: "array", items: { type: "string" } },
            businessContext: { type: "string" }
          },
          required: [
            "coreResponsibilities",
            "mustHaves",
            "bonusSignals",
            "hiddenPreferences",
            "atsKeywords",
            "businessContext"
          ]
        },
        resumeAnalysis: {
          type: "object",
          additionalProperties: false,
          properties: {
            preservedSections: { type: "array", items: { type: "string" } },
            evidenceUnits: { type: "array", items: { type: "string" } },
            strongEvidence: { type: "array", items: { type: "string" } },
            weakEvidence: { type: "array", items: { type: "string" } }
          },
          required: ["preservedSections", "evidenceUnits", "strongEvidence", "weakEvidence"]
        },
        alignment: {
          type: "object",
          additionalProperties: false,
          properties: {
            strengths: { type: "array", items: { type: "string" } },
            gaps: { type: "array", items: { type: "string" } },
            priorities: { type: "array", items: { type: "string" } }
          },
          required: ["strengths", "gaps", "priorities"]
        },
        validation: {
          type: "object",
          additionalProperties: false,
          properties: {
            unsupportedClaims: { type: "array", items: { type: "string" } },
            overfitRisks: { type: "array", items: { type: "string" } },
            toneRisks: { type: "array", items: { type: "string" } },
            followUps: { type: "array", items: { type: "string" } }
          },
          required: ["unsupportedClaims", "overfitRisks", "toneRisks", "followUps"]
        }
      },
      required: ["summary", "jdAnalysis", "resumeAnalysis", "alignment", "validation"]
    };
  }

  if (name === "resume_tailor_draft" || name === "resume_tailor_revision") {
    return {
      type: "object",
      additionalProperties: false,
      properties: {
        summary: { type: "string" },
        draftTitle: { type: "string" },
        draftText: { type: "string" }
      },
      required: ["summary", "draftTitle", "draftText"]
    };
  }

  if (name === "resume_extract") {
    return {
      type: "object",
      additionalProperties: false,
      properties: {
        extractedText: { type: "string" }
      },
      required: ["extractedText"]
    };
  }

  return {
    type: "object",
    additionalProperties: false,
    properties: {
      eventType: {
        type: "string",
        enum: ["NOTE", "ASSESSMENT", "INTERVIEW", "OFFER", "REJECTION", "DEADLINE"]
      },
      eventTime: { type: ["string", "null"] },
      requirements: { type: "array", items: { type: "string" } },
      summary: { type: "string" }
    },
    required: ["eventType", "eventTime", "requirements", "summary"]
  };
}

export async function extractResumeTextFromImage(input: {
  imagePath: string;
  imageMimeType: string;
  fileName?: string;
  settings?: UserAiSettings;
}) {
  if (!hasOpenAI(input.settings)) {
    return {
      provider: "local" as AIProvider,
      note: "未配置 OPENAI_API_KEY，当前无法对图片简历执行 OCR。",
      data: { extractedText: "" }
    };
  }

  try {
    const result = await createStructuredResponse({
      schema: resumeExtractSchema,
      schemaName: "resume_extract",
      systemPrompt:
        "你是一个简历 OCR 助手。请准确提取图片中的简历正文，尽量保留原有分段和项目符号，不要总结，不要补写看不见的内容。",
      userPrompt: `请提取这张简历图片中的可见正文。文件名：${input.fileName || "未知简历"}。如果某些内容看不清，就跳过，不要猜测。`,
      imagePath: input.imagePath,
      imageMimeType: input.imageMimeType,
      model: getVisionModel(input.settings),
      settings: input.settings
    });

    return {
      provider: "openai" as AIProvider,
      note: "已使用 OpenAI 视觉模型从图片简历中提取正文。",
      data: {
        extractedText: result.extractedText.trim()
      }
    };
  } catch {
    return {
      provider: "local" as AIProvider,
      note: "图片简历 OCR 失败，建议补充版本备注或改用可复制文字的 PDF / Word。",
      data: { extractedText: "" }
    };
  }
}

export async function normalizeResumeExtraction(input: {
  fileName?: string;
  nativeText: string;
  layoutText: string;
  settings?: UserAiSettings;
}) {
  const nativeText = input.nativeText.trim();
  const layoutText = input.layoutText.trim();

  if (!nativeText && !layoutText) {
    return {
      provider: "local" as AIProvider,
      note: "未拿到可用于融合校正的简历正文。",
      data: { extractedText: "" }
    };
  }

  if (!hasOpenAI(input.settings)) {
    return {
      provider: "local" as AIProvider,
      note: "未配置 OPENAI_API_KEY，当前仅使用本地布局顺序兜底，不执行正文融合校正。",
      data: { extractedText: layoutText || nativeText }
    };
  }

  try {
    const result = await createStructuredResponse({
      schema: resumeExtractSchema,
      schemaName: "resume_extract",
      model: getTextModel(input.settings),
      systemPrompt:
        "你是一个简历正文融合校正助手。候选 A 通常文字更准，但段落顺序可能错乱；候选 B 通常更接近页面阅读顺序，但可能有少量错字、漏字或格式损失。请输出一份最终简历正文，要求：1. 保持页面自然阅读顺序；2. 优先采用候选 A 的准确文字、数字、邮箱、电话、时间和专有名词；3. 只做对齐、排序、纠错与补缺，不要总结，不要润色，不要改写语气，不要新增看不见的内容；4. 忽略头像等非文字内容；5. 尽量保留分段。",
      userPrompt: `文件名：${input.fileName || "未知简历"}\n\n候选 A（原生提取，文字通常更准）:\n${nativeText || "【空】"}\n\n候选 B（布局顺序基准）:\n${layoutText || "【空】"}\n\n请输出最终校正后的简历正文。`,
      settings: input.settings
    });

    return {
      provider: "openai" as AIProvider,
      note: "已使用 OpenAI 对模板简历正文执行顺序校正与文字核验。",
      data: {
        extractedText: result.extractedText.trim()
      }
    };
  } catch {
    return {
      provider: "local" as AIProvider,
      note: "简历正文融合校正失败，当前回退为本地布局顺序版本。",
      data: { extractedText: layoutText || nativeText }
    };
  }
}

export async function extractJobTextFromImage(input: {
  imagePath: string;
  imageMimeType: string;
  fileName?: string;
  settings?: UserAiSettings;
}) {
  if (!hasOpenAI(input.settings)) {
    return {
      provider: "local" as AIProvider,
      note: "未配置 OPENAI_API_KEY，当前无法对岗位截图执行 OCR。",
      data: { extractedText: "" }
    };
  }

  try {
    const result = await createStructuredResponse({
      schema: resumeExtractSchema,
      schemaName: "resume_extract",
      systemPrompt:
        "你是一个岗位截图 OCR 助手。请准确提取截图中的岗位正文、标题、薪资、城市、要求等可见文字，尽量保留原有分段，不要总结，不要补写看不见的内容。",
      userPrompt: `请提取这张岗位截图中的可见正文。文件名：${input.fileName || "未知截图"}。如果某些内容看不清，就跳过，不要猜测。`,
      imagePath: input.imagePath,
      imageMimeType: input.imageMimeType,
      model: getVisionModel(input.settings),
      settings: input.settings
    });

    return {
      provider: "openai" as AIProvider,
      note: "已使用 OpenAI 视觉模型从岗位截图中提取正文。",
      data: {
        extractedText: result.extractedText.trim()
      }
    };
  } catch (error) {
    const failureReason = getErrorMessage(error).replace(/\s+/g, " ").trim() || "未知错误";

    return {
      provider: "local" as AIProvider,
      note: `岗位截图 OCR 失败。失败原因：${failureReason}。建议补充关键岗位信息，或改用可复制文字的岗位正文。`,
      data: { extractedText: "" }
    };
  }
}

export async function parseJobLead(input: {
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
      const parsed = await createStructuredResponse({
        schema: importedJobSchema,
        schemaName: "job_lead_parse",
        systemPrompt:
          "你是一个求职产品里的岗位解析助手。你要把岗位描述或招聘截图转成稳定、简洁、可编辑的结构化 JSON。不要编造看不到的信息，不确定时返回 null 或空数组。",
        userPrompt: `请从下面的岗位信息中提取结构化字段。\n\n来源类型: ${input.sourceType}\n来源名称: ${input.sourceName || "未知"}\n来源链接: ${input.sourceUrl || "无"}\n\n岗位原文:\n${input.rawContent}`,
        imagePath: input.imagePath,
        imageMimeType: input.imageMimeType,
        settings: input.settings
      });

      return {
        provider: "openai" as AIProvider,
        note: "已使用 OpenAI 结构化输出完成岗位解析。",
        data: {
          ...parsed,
          sourceName: parsed.sourceName || input.sourceName,
          sourceUrl: parsed.sourceUrl || input.sourceUrl,
          city: parsed.city || undefined,
          seniority: parsed.seniority || undefined,
          salaryRange: parsed.salaryRange || undefined,
          parsedSummary: parsed.parsedSummary || undefined
        } as ImportedJob
      };
    } catch {
      // Fall through to deterministic local parsing so the MVP never blocks on API issues.
      const raw = fallbackParseJobLead(input.rawContent, input);
      return {
        provider: "local" as AIProvider,
        note:
          input.sourceType === "SCREENSHOT"
            ? "OpenAI 图片解析失败，当前已降级为本地规则兜底。本地模式不会自动识别截图文字，请手动补充关键岗位信息。"
            : "OpenAI 解析失败，已自动降级到本地规则解析。",
        data: raw
      };
    }
  }

  return {
    provider: "local" as AIProvider,
    note:
      input.sourceType === "SCREENSHOT"
        ? "未配置 OPENAI_API_KEY，当前使用本地规则兜底。本地模式不会自动 OCR 截图，请手动补充关键岗位信息。"
        : "未配置 OPENAI_API_KEY，当前使用本地规则解析。",
    data: fallbackParseJobLead(input.rawContent, input)
  };
}

export async function tailorResume(input: {
  mode: "advice" | "draft";
  jobTitle: string;
  companyName: string;
  resumeText: string;
  jobSummary: string;
  skills: string[];
  requirements: string[];
  customInstructions?: string;
  settings?: UserAiSettings;
}) {
  if (hasOpenAI(input.settings)) {
    try {
      const result = await createStructuredResponse({
        schema: input.mode === "advice" ? tailorAnalysisSchema : tailorDraftSchema,
        schemaName: input.mode === "advice" ? "resume_tailor_advice" : "resume_tailor_draft",
        model: getTextModel(input.settings),
        systemPrompt:
          input.mode === "advice"
            ? "你是一个简历微调分析助手，不是自由写作助手。请按下面顺序工作：1. 标准化输入与约束；2. 解析 JD 的核心职责、必备能力、加分项、隐含偏好、ATS 关键词和业务语境；3. 解析原始简历，识别原有的分区结构与可用证据；4. 评估 JD 与简历素材的匹配度和风险；5. 做风险校验。输出时只允许返回结构化分析，不要输出气泡式建议，不要输出具体分数，不要输出 draftTitle，不要输出 draftText，不要写成第一人称。"
            : "你是一个简历微调草稿助手。请基于原始简历和 JD 直接输出一份完整简历草稿，以及一句简短的本轮草稿说明。草稿必须尽量保留用户原始简历已有的主要分区结构和顺序，例如项目经历、实习经历、教育经历、个人优势等部分都要尽量保留；只允许微调每个部分内部的表述方式、强调重点和排序，不要把原本结构打散重写，不要新增不存在的章节，不要虚构项目、数字或经历，不要使用第一人称表述，如“我”“本人”。除了原文已经是列表的地方，不要统一补项目符号。不要输出评分，不要输出气泡建议，不要解释分析过程。",
        userPrompt: `目标公司: ${input.companyName}
目标岗位: ${input.jobTitle}
岗位摘要: ${input.jobSummary || "无"}
技能关键词: ${input.skills.join("、") || "无"}
岗位要求: ${input.requirements.join("；") || "无"}
用户额外要求: ${input.customInstructions?.trim() || "无"}

候选人简历正文:
${input.resumeText}`,
        settings: input.settings
      });

      return {
        provider: "openai" as AIProvider,
        note: input.mode === "advice" ? "已使用 OpenAI 生成结构化匹配分析。" : "已使用 OpenAI 生成完整简历草稿。",
        data: result
      };
    } catch {
      return {
        provider: "local" as AIProvider,
        note: input.mode === "advice" ? "OpenAI 微调分析失败，已自动降级到本地分析模板。" : "OpenAI 草稿生成失败，已自动降级到本地草稿模板。",
        data: fallbackTailorResume(input)
      };
    }
  }

  return {
    provider: "local" as AIProvider,
    note: input.mode === "advice" ? "未配置 OPENAI_API_KEY，当前使用本地分析模板。" : "未配置 OPENAI_API_KEY，当前使用本地草稿模板。",
    data: fallbackTailorResume(input)
  };
}

export async function reviseResumeDraft(input: {
  jobTitle: string;
  companyName: string;
  resumeText: string;
  currentDraftTitle: string;
  currentDraftText: string;
  customInstructions: string;
  settings?: UserAiSettings;
}) {
  if (hasOpenAI(input.settings)) {
    try {
      const result = await createStructuredResponse({
        schema: tailorDraftSchema,
        schemaName: "resume_tailor_revision",
        model: getTextModel(input.settings),
        systemPrompt:
          "你是一个简历微调草稿助手。请基于当前草稿继续修改，不要脱离候选人的真实经历，不要虚构项目、数字或未出现过的核心事实。输出新的草稿标题、草稿正文，以及一句简洁的本轮修改说明。修改时必须尽量保留当前草稿以及原始简历已有的主要分区结构和顺序，例如项目经历、实习经历、教育经历、个人优势等部分不要随意删改或打散；只微调每个部分内部的表达方式、强调重点和岗位匹配度。整份草稿要保持简历写法，避免使用第一人称表述，如“我”“本人”。除了原文本身就是列表的地方，不要统一在每一行前添加 -、*、• 这类项目符号。不要输出评分，不要输出结构化分析。",
        userPrompt: `目标公司: ${input.companyName}
目标岗位: ${input.jobTitle}
用户本轮修改要求: ${input.customInstructions}

候选人简历原始正文:
${input.resumeText}

当前草稿标题:
${input.currentDraftTitle || "未命名草稿"}

当前草稿正文:
${input.currentDraftText}`,
        settings: input.settings
      });

      return {
        provider: "openai" as AIProvider,
        note: "已根据新要求继续修改当前草稿。",
        data: result
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      return {
        provider: "local" as AIProvider,
        note: `OpenAI 草稿迭代失败，已保留当前草稿。错误详情：${message.slice(0, 220)}`,
        data: {
          summary: "这次没有生成新的草稿版本，系统保留了你当前的草稿内容。",
          draftTitle: input.currentDraftTitle,
          draftText: input.currentDraftText
        }
      };
    }
  }

  return {
    provider: "local" as AIProvider,
    note: "未配置 OPENAI_API_KEY，当前保留原草稿。",
    data: {
      summary: "当前没有可用的在线模型，本次保留原草稿内容。",
      draftTitle: input.currentDraftTitle,
      draftText: input.currentDraftText
    }
  };
}

export async function parseNotification(input: {
  content: string;
  imagePath?: string;
  imageMimeType?: string;
  settings?: UserAiSettings;
}) {
  if (hasOpenAI(input.settings)) {
    try {
      const result = await createStructuredResponse({
        schema: notificationSchema,
        schemaName: "notification_parse",
        systemPrompt:
          "你是一个求职通知解析助手。请从邮件正文、聊天通知或截图中提取事件类型、时间、要求和一句简洁摘要。不确定的时间返回 null。",
        userPrompt: `请解析下面的通知内容，并提炼成事件记录。\n\n通知原文:\n${input.content}`,
        imagePath: input.imagePath,
        imageMimeType: input.imageMimeType,
        settings: input.settings
      });

      return {
        provider: "openai" as AIProvider,
        note: "已使用 OpenAI 解析通知内容并提取事件信息。",
        data: result
      };
    } catch {
      // Fall through to local parsing.
      return {
        provider: "local" as AIProvider,
        note: "OpenAI 通知解析失败，已自动降级到本地规则解析。",
        data: fallbackNotification(input.content)
      };
    }
  }

  return {
    provider: "local" as AIProvider,
    note: "未配置 OPENAI_API_KEY，当前使用本地规则解析通知。",
    data: fallbackNotification(input.content)
  };
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

function fallbackTailorResume(input: {
  mode: "advice" | "draft";
  jobTitle: string;
  companyName: string;
  resumeText: string;
  skills: string[];
  customInstructions?: string;
}) {
  const keywordGaps = input.skills.slice(0, 3).filter((skill) => !input.resumeText.includes(skill));

  if (input.mode === "draft") {
    return {
      summary: `已基于原始简历结构生成 ${input.companyName} ${input.jobTitle} 的完整草稿，本地兜底模式会尽量保留原分区顺序。`,
      draftTitle: `${input.companyName}-${input.jobTitle}`,
      draftText: buildDraftResume(input)
    };
  }

  return {
    summary: `该岗位更看重 ${input.skills.slice(0, 3).join(" / ")}，当前简历需要更突出与 ${input.companyName} ${input.jobTitle} 直接相关的项目成果。`,
    jdAnalysis: {
      coreResponsibilities: [input.jobTitle],
      mustHaves: input.skills.slice(0, 4),
      bonusSignals: [],
      hiddenPreferences: [],
      atsKeywords: input.skills.slice(0, 6),
      businessContext: `${input.companyName} ${input.jobTitle} 的本地兜底分析结果。`
    },
    resumeAnalysis: {
      preservedSections: ["教育经历", "项目经历", "实习经历", "个人优势"].filter((section) => input.resumeText.includes(section)),
      evidenceUnits: ["保留原始简历分区结构，只调整内部表述。"],
      strongEvidence: [],
      weakEvidence: keywordGaps
    },
    alignment: {
      strengths: [`已有经历可朝 ${input.jobTitle} 方向重写`],
      gaps: keywordGaps,
      priorities: ["优先调整最相关经历的表述顺序和关键词表达"]
    },
    validation: {
      unsupportedClaims: [],
      overfitRisks: [],
      toneRisks: [],
      followUps: []
    }
  };
}

function buildDraftResume(input: {
  jobTitle: string;
  companyName: string;
  resumeText: string;
}) {
  return input.resumeText.trim();
}

function fallbackNotification(content: string) {
  const type = content.includes("面试") ? "INTERVIEW" : content.includes("笔试") ? "ASSESSMENT" : "NOTE";
  const dateMatch = /\d{4}[/-]\d{1,2}[/-]\d{1,2}(?:\s+\d{1,2}:\d{2})?/.exec(content);

  return {
    eventType: type,
    eventTime: dateMatch?.[0] ?? null,
    requirements: extractList(content, ["身份证", "电脑", "摄像头", "作品集", "简历"]),
    summary: "已抽取一条基础通知记录，建议用户进一步确认时间和材料要求。"
  };
}
