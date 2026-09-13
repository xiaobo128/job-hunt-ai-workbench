import path from "node:path";
import { z } from "zod";
import {
  ExtractedResumeSchema,
  ResumeExtractionProviderError,
  type ExtractedResume,
  type ResumeExtractionInput,
  type ResumeExtractionProvider,
  type ResumeExtractionResult
} from "@/lib/resume-parsing/core";

const TEXTIN_ENDPOINT = "https://api.textin.com/ai/service/v3/entity_extraction";
const TEXTIN_TIMEOUT_MS = 120_000;
const TEXTIN_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

const textInResumeSchema = {
  type: "object",
  properties: {
    "姓名": { type: "string" },
    "联系方式": {
      type: "object",
      properties: { "电话": { type: "string" }, "邮箱": { type: "string" } }
    },
    "教育经历": { type: "array", items: { type: "object", properties: entryProperties("学校", "专业或学位") } },
    "实习经历": {
      type: "array",
      description: "只包含明确标注为实习的经历；不要包含正式工作或项目。",
      items: { type: "object", properties: entryProperties("公司", "职位") }
    },
    "工作经历": {
      type: "array",
      description: "只包含明确标注为正式工作的经历；不要包含实习或项目。",
      items: { type: "object", properties: entryProperties("公司", "职位") }
    },
    "项目经历": { type: "array", items: { type: "object", properties: entryProperties("项目名称", "角色") } },
    "技能": { type: "array", items: { type: "string" } }
  },
  required: ["姓名", "联系方式", "教育经历", "实习经历", "工作经历", "项目经历", "技能"]
} as const;

function entryProperties(heading: string, subheading: string) {
  return {
    [heading]: { type: "string" },
    [subheading]: { type: "string" },
    "开始日期": { type: "string", description: "按简历原文保留" },
    "结束日期": { type: "string", description: "按简历原文保留；至今、现在或 Present 原样保留" },
    "内容": { type: "string", description: "保留简历明确列出的职责或成果原文；不要改写" }
  };
}

const textInEntrySchema = z.object({
  "学校": z.string().nullable().optional(),
  "专业或学位": z.string().nullable().optional(),
  "公司": z.string().nullable().optional(),
  "职位": z.string().nullable().optional(),
  "项目名称": z.string().nullable().optional(),
  "角色": z.string().nullable().optional(),
  "开始日期": z.string().nullable().optional(),
  "结束日期": z.string().nullable().optional(),
  "日期": z.string().nullable().optional(),
  "内容": z.string().nullable().optional()
});

const textInExtractedSchema = z.object({
  "姓名": z.string().nullable().optional(),
  "联系方式": z.object({ "电话": z.string().nullable().optional(), "邮箱": z.string().nullable().optional() }).nullable().optional(),
  "教育经历": z.array(textInEntrySchema).optional().default([]),
  "实习经历": z.array(textInEntrySchema).optional().default([]),
  "工作经历": z.array(textInEntrySchema).optional().default([]),
  "未分类经历": z.array(textInEntrySchema).optional().default([]),
  "项目经历": z.array(textInEntrySchema).optional().default([]),
  "技能": z.array(z.string()).optional().default([])
});

const textInEnvelopeSchema = z.object({
  code: z.number(),
  message: z.string().optional(),
  duration: z.number().nullable().optional(),
  x_request_id: z.string().nullable().optional(),
  status: z.string().optional(),
  result: z.object({ extracted_schema: z.unknown().optional() }).optional()
});

function mapEntry(entry: z.infer<typeof textInEntrySchema>, heading: "学校" | "公司" | "项目名称", subheading: "专业或学位" | "职位" | "角色") {
  return {
    heading: entry[heading],
    subheading: entry[subheading],
    startDate: entry["开始日期"],
    endDate: entry["结束日期"],
    dateText: entry["日期"],
    content: entry["内容"],
    bullets: [],
    originalText: null
  };
}

function mapExtraction(value: unknown): ExtractedResume {
  const extracted = textInExtractedSchema.safeParse(value);
  if (!extracted.success) {
    throw new ResumeExtractionProviderError("RESPONSE", "TextIn returned an invalid extracted resume structure.");
  }

  const data = extracted.data;
  return ExtractedResumeSchema.parse({
    name: data["姓名"],
    phone: data["联系方式"]?.["电话"],
    email: data["联系方式"]?.["邮箱"],
    education: data["教育经历"].map((entry) => mapEntry(entry, "学校", "专业或学位")),
    internships: data["实习经历"].map((entry) => mapEntry(entry, "公司", "职位")),
    workExperiences: data["工作经历"].map((entry) => mapEntry(entry, "公司", "职位")),
    projectExperiences: data["项目经历"].map((entry) => mapEntry(entry, "项目名称", "角色")),
    skills: data["技能"],
    warnings: data["未分类经历"].length > 0
      ? [{
          code: "UNCLASSIFIED_EMPLOYMENT" as const,
          message: "TextIn returned employment entries that were not explicitly classified as internship or work."
        }]
      : []
  });
}

function validateInput(input: ResumeExtractionInput) {
  const extension = path.extname(input.fileName).toLowerCase();
  if (extension !== ".pdf" && extension !== ".docx") {
    throw new ResumeExtractionProviderError("INVALID_INPUT", "Only PDF and DOCX resume files are supported.");
  }
  if (input.bytes.length === 0 || input.bytes.length > TEXTIN_MAX_FILE_SIZE_BYTES) {
    throw new ResumeExtractionProviderError("INVALID_INPUT", "Resume file must be greater than 0 bytes and no larger than 50 MB.");
  }
}

export class TextInResumeExtractionProvider implements ResumeExtractionProvider {
  async extract(input: ResumeExtractionInput): Promise<ResumeExtractionResult> {
    validateInput(input);
    const appId = process.env.TEXTIN_APP_ID?.trim();
    const secretCode = process.env.TEXTIN_SECRET_CODE?.trim();
    if (!appId || !secretCode) {
      throw new ResumeExtractionProviderError("CONFIGURATION", "TextIn server credentials are not configured.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TEXTIN_TIMEOUT_MS);
    try {
      const response = await fetch(TEXTIN_ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-ti-app-id": appId,
          "x-ti-secret-code": secretCode
        },
        body: JSON.stringify({
          file: { file_base64: input.bytes.toString("base64"), file_name: input.fileName },
          schema: textInResumeSchema
        }),
        signal: controller.signal
      });

      const raw = await response.text();
      let json: unknown;
      try {
        json = JSON.parse(raw);
      } catch {
        throw new ResumeExtractionProviderError("RESPONSE", "TextIn returned a non-JSON response.");
      }

      const envelope = textInEnvelopeSchema.safeParse(json);
      if (!envelope.success) {
        throw new ResumeExtractionProviderError("RESPONSE", "TextIn returned an invalid response envelope.");
      }
      if (!response.ok || envelope.data.code !== 200 || envelope.data.status !== "finished") {
        throw new ResumeExtractionProviderError("PROVIDER", `TextIn could not extract this resume (code ${envelope.data.code}).`);
      }
      if (envelope.data.result?.extracted_schema === undefined) {
        throw new ResumeExtractionProviderError("RESPONSE", "TextIn response did not include extracted resume data.");
      }

      return {
        extraction: mapExtraction(envelope.data.result.extracted_schema),
        metadata: {
          provider: "textin",
          requestId: envelope.data.x_request_id ?? null,
          duration: envelope.data.duration ?? null
        }
      };
    } catch (error) {
      if (error instanceof ResumeExtractionProviderError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new ResumeExtractionProviderError("TIMEOUT", "TextIn request timed out.");
      }
      throw new ResumeExtractionProviderError("TRANSPORT", "TextIn request failed.");
    } finally {
      clearTimeout(timeout);
    }
  }
}
