import { z } from "zod";
import type { ResumeDocument } from "@/lib/resume-parsing/core";

const dimensionNames = [
  "education",
  "specialRequirements",
  "workExperience",
  "projectExperience",
  "skills",
  "domainRelevance",
  "strengths"
] as const;

export type ResumeAnalysisDimensionName = (typeof dimensionNames)[number];

const evidenceRefSchema = z
  .object({
    sectionId: z.string().uuid(),
    itemId: z.string().uuid().nullable(),
    bulletId: z.string().uuid().nullable()
  })
  .strict();

const dimensionSchema = z
  .object({
    rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.null()]),
    evidenceRefs: z.array(evidenceRefSchema),
    gap: z.string().nullable(),
    suggestion: z.string().nullable()
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.rating === null && (value.evidenceRefs.length > 0 || value.gap !== null || value.suggestion !== null)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "rating=null only means the JD does not address this dimension." });
    }
    if (value.rating !== null && value.rating <= 2 && (!value.gap || !value.suggestion)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Low ratings require a gap and suggestion." });
    }
  });

export const ResumeAnalysisSchema = z
  .object({
    education: dimensionSchema,
    specialRequirements: dimensionSchema,
    workExperience: dimensionSchema,
    projectExperience: dimensionSchema,
    skills: dimensionSchema,
    domainRelevance: dimensionSchema,
    strengths: dimensionSchema
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.strengths.rating !== null && value.strengths.evidenceRefs.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Strengths require verifiable resume evidence." });
    }
  });

export type ResumeAnalysis = z.infer<typeof ResumeAnalysisSchema>;

export const ResumeAnalysisEnvelopeSchema = z
  .object({
    kind: z.literal("resume_analysis"),
    analysisSchemaVersion: z.literal(1),
    sourceResumeParseId: z.string().min(1),
    dimensions: ResumeAnalysisSchema
  })
  .strict();

export type ResumeAnalysisEvidenceFailure = {
  dimension: ResumeAnalysisDimensionName;
  refIndex: number;
  layer: "section" | "item" | "bullet" | "shape";
  reason: "section_not_found" | "item_not_found" | "bullet_not_found" | "bullet_requires_item";
};

/** Returns only reference metadata; it never includes resume text. */
export function findResumeAnalysisEvidenceFailure(
  analysis: ResumeAnalysis,
  document: ResumeDocument
): ResumeAnalysisEvidenceFailure | null {
  const sections = new Map(document.sections.map((section) => [section.id, section]));

  for (const dimension of dimensionNames) {
    for (const [refIndex, reference] of analysis[dimension].evidenceRefs.entries()) {
      const section = sections.get(reference.sectionId);
      if (!section) return { dimension, refIndex, layer: "section", reason: "section_not_found" };
      if (reference.itemId === null) {
        if (reference.bulletId !== null) {
          return { dimension, refIndex, layer: "shape", reason: "bullet_requires_item" };
        }
        continue;
      }
      const item = section.items.find((candidate) => candidate.id === reference.itemId);
      if (!item) return { dimension, refIndex, layer: "item", reason: "item_not_found" };
      if (reference.bulletId !== null && !item.bullets.some((bullet) => bullet.id === reference.bulletId)) {
        return { dimension, refIndex, layer: "bullet", reason: "bullet_not_found" };
      }
    }
  }

  return null;
}

export function validateResumeAnalysisEvidence(analysis: ResumeAnalysis, document: ResumeDocument) {
  return findResumeAnalysisEvidenceFailure(analysis, document) === null;
}

/** A stable text view for legacy draft prompts; it never reads legacy resume text. */
export function formatResumeDocument(document: ResumeDocument) {
  const basics = [document.basics.name, document.basics.phone, document.basics.email].filter((value): value is string => Boolean(value));
  const sections = document.sections.map((section) => {
    const items = section.items.map((item) => {
      const dates = [item.startDate, item.endDate].filter(Boolean).join(" - ");
      return [
        [item.heading, item.subheading, dates].filter(Boolean).join(" | "),
        item.originalText || "",
        ...item.bullets.map((bullet) => `- ${bullet.text}`)
      ]
        .filter(Boolean)
        .join("\n");
    });
    return [section.title, ...items].join("\n");
  });

  return [...basics, ...sections].filter(Boolean).join("\n\n");
}
