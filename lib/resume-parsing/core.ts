import { randomUUID } from "node:crypto";
import { z } from "zod";

const NullableTextSchema = z.string().nullable().optional();

export const ExtractedResumeEntrySchema = z.object({
  heading: NullableTextSchema,
  subheading: NullableTextSchema,
  startDate: NullableTextSchema,
  endDate: NullableTextSchema,
  dateText: NullableTextSchema,
  content: NullableTextSchema,
  bullets: z.array(z.string()).default([]),
  originalText: NullableTextSchema
});

export const ExtractedResumeWarningSchema = z.object({
  code: z.literal("UNCLASSIFIED_EMPLOYMENT"),
  message: z.string()
});

export const ExtractedResumeSchema = z.object({
  name: NullableTextSchema,
  phone: NullableTextSchema,
  email: NullableTextSchema,
  education: z.array(ExtractedResumeEntrySchema).default([]),
  internships: z.array(ExtractedResumeEntrySchema).default([]),
  workExperiences: z.array(ExtractedResumeEntrySchema).default([]),
  projectExperiences: z.array(ExtractedResumeEntrySchema).default([]),
  skills: z.array(z.string()).default([]),
  warnings: z.array(ExtractedResumeWarningSchema).default([])
});

export type ExtractedResumeEntry = z.infer<typeof ExtractedResumeEntrySchema>;
export type ExtractedResumeWarning = z.infer<typeof ExtractedResumeWarningSchema>;
export type ExtractedResume = z.infer<typeof ExtractedResumeSchema>;

export const ResumeBulletSchema = z.object({
  id: z.string().uuid(),
  text: z.string().min(1)
});

export const ResumeItemSchema = z.object({
  id: z.string().uuid(),
  heading: z.string().min(1),
  subheading: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  originalText: z.string().nullable(),
  bullets: z.array(ResumeBulletSchema)
});

export const ResumeSectionSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["education", "internship", "work", "projectExperience", "skills"]),
  title: z.string().min(1),
  items: z.array(ResumeItemSchema).min(1)
});

export const ResumeDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  basics: z.object({
    name: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable()
  }),
  sections: z.array(ResumeSectionSchema)
});

export type ResumeBullet = z.infer<typeof ResumeBulletSchema>;
export type ResumeItem = z.infer<typeof ResumeItemSchema>;
export type ResumeSection = z.infer<typeof ResumeSectionSchema>;
export type ResumeDocument = z.infer<typeof ResumeDocumentSchema>;

function createId(): ResumeSection["id"] {
  return randomUUID() as ResumeSection["id"];
}

export type ResumeExtractionInput = {
  bytes: Buffer;
  fileName: string;
};

export type ResumeExtractionResult = {
  extraction: ExtractedResume;
  metadata: {
    provider: "textin";
    requestId: string | null;
    duration: number | null;
  };
};

export interface ResumeExtractionProvider {
  extract(input: ResumeExtractionInput): Promise<ResumeExtractionResult>;
}

export class ResumeExtractionProviderError extends Error {
  readonly code: "CONFIGURATION" | "INVALID_INPUT" | "TIMEOUT" | "TRANSPORT" | "RESPONSE" | "PROVIDER";

  constructor(
    code: ResumeExtractionProviderError["code"],
    message: string
  ) {
    super(message);
    this.name = "ResumeExtractionProviderError";
    this.code = code;
  }
}

function cleanText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function splitDateRange(dateText: string | null | undefined) {
  const value = cleanText(dateText);
  if (!value) return { startDate: null, endDate: null };

  const match = value.match(/^(.+?)\s+(?:至|to)\s+(.+)$/i) ?? value.match(/^(.+?)\s*[-–—~～]\s*(.+)$/);
  if (!match) return { startDate: null, endDate: null };

  const startDate = cleanText(match[1]);
  const endDate = cleanText(match[2]);
  return startDate && endDate ? { startDate, endDate } : { startDate: null, endDate: null };
}

function normalizeBulletText(value: string) {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length > 1 && lines.every((line) => /^(?:[•●▪◦·*-]|\d+[.)、])\s+/.test(line))) {
    return lines.map((line) => line.replace(/^(?:[•●▪◦·*-]|\d+[.)、])\s+/, "").trim()).filter(Boolean);
  }

  const text = value.trim();
  return text ? [text] : [];
}

function createItem(entry: ExtractedResumeEntry): ResumeItem | null {
  const heading = cleanText(entry.heading);
  if (!heading) return null;

  const explicitBullets = entry.bullets.flatMap(normalizeBulletText);
  const contentBullets = explicitBullets.length === 0 && entry.content ? normalizeBulletText(entry.content) : [];
  const dateRange = !cleanText(entry.startDate) && !cleanText(entry.endDate) ? splitDateRange(entry.dateText) : null;

  return {
    id: createId(),
    heading,
    subheading: cleanText(entry.subheading),
    startDate: cleanText(entry.startDate) ?? dateRange?.startDate ?? null,
    endDate: cleanText(entry.endDate) ?? dateRange?.endDate ?? null,
    originalText: cleanText(entry.originalText),
    bullets: [...explicitBullets, ...contentBullets].map((text) => ({ id: createId(), text }))
  };
}

function createSection(kind: ResumeSection["kind"], title: string, entries: ExtractedResumeEntry[]) {
  const items = entries.map(createItem).filter((item): item is ResumeItem => item !== null);
  return items.length > 0 ? { id: createId(), kind, title, items } : null;
}

function createSkillsSection(skills: string[]) {
  const bullets = skills.flatMap(normalizeBulletText).map((text) => ({ id: createId(), text }));
  if (bullets.length === 0) return null;

  return {
    id: createId(),
    kind: "skills" as const,
    title: "技能",
    items: [{
      id: createId(),
      heading: "技能",
      subheading: null,
      startDate: null,
      endDate: null,
      originalText: null,
      bullets
    }]
  };
}

export function normalizeExtractedResume(input: ExtractedResume): ResumeDocument {
  const extraction = ExtractedResumeSchema.parse(input);
  const sections = [
    createSection("education", "教育经历", extraction.education),
    createSection("internship", "实习经历", extraction.internships),
    createSection("work", "工作经历", extraction.workExperiences),
    createSection("projectExperience", "项目经历", extraction.projectExperiences),
    createSkillsSection(extraction.skills)
  ].filter((section): section is ResumeSection => section !== null);

  return ResumeDocumentSchema.parse({
    schemaVersion: 1,
    basics: {
      name: cleanText(extraction.name),
      phone: cleanText(extraction.phone),
      email: cleanText(extraction.email)
    },
    sections
  });
}
