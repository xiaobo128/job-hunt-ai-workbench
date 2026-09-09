import { ApplicationStage, EventType, ResumeVariantSourceType, SourceType } from "@prisma/client";
import { z } from "zod";

const trimmedString = z.string().trim();
const optionalTrimmedString = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .optional();
const stringArray = z.array(trimmedString.min(1)).optional().default([]);

export const agentJobCreateSchema = z.object({
  companyName: trimmedString.min(1),
  roleTitle: trimmedString.min(1),
  rawContent: trimmedString.min(1),
  city: optionalTrimmedString,
  sourceName: optionalTrimmedString,
  sourceUrl: optionalTrimmedString,
  note: optionalTrimmedString,
  parsedSummary: optionalTrimmedString,
  applicationNote: optionalTrimmedString,
  seniority: optionalTrimmedString,
  salaryRange: optionalTrimmedString,
  sourceType: z.nativeEnum(SourceType).optional().default(SourceType.MANUAL),
  initialStage: z.nativeEnum(ApplicationStage).optional(),
  status: z.nativeEnum(ApplicationStage).optional(),
  skills: stringArray,
  requirements: stringArray,
  responsibilities: stringArray
});

export const agentApplicationPatchSchema = z
  .object({
    currentStage: z.nativeEnum(ApplicationStage).optional(),
    stage: z.nativeEnum(ApplicationStage).optional(),
    note: z.string().optional().nullable()
  })
  .refine((value) => Boolean(value.currentStage || value.stage), {
    message: "`currentStage` or `stage` is required.",
    path: ["currentStage"]
  });

export const agentResumeVariantCreateSchema = z.object({
  resumeId: trimmedString.min(1),
  jobLeadId: optionalTrimmedString,
  sourceType: z.nativeEnum(ResumeVariantSourceType).optional().default(ResumeVariantSourceType.AI_DRAFT),
  title: trimmedString.min(1),
  note: optionalTrimmedString,
  fileUrl: optionalTrimmedString,
  artifactName: optionalTrimmedString,
  artifactMimeType: optionalTrimmedString,
  draftText: optionalTrimmedString
});

export const agentEventCreateSchema = z.object({
  applicationId: trimmedString.min(1),
  eventType: z.nativeEnum(EventType),
  title: trimmedString.min(1),
  eventTime: optionalTrimmedString,
  content: optionalTrimmedString,
  provider: optionalTrimmedString,
  aiNote: optionalTrimmedString,
  artifactName: optionalTrimmedString,
  artifactUrl: optionalTrimmedString,
  requirements: stringArray
});

export const agentTailorRunCreateSchema = z.object({
  resumeId: trimmedString.min(1),
  jobLeadId: trimmedString.min(1),
  provider: optionalTrimmedString,
  aiNote: optionalTrimmedString,
  summary: trimmedString.min(1),
  draftTitle: optionalTrimmedString,
  draftText: optionalTrimmedString,
  suggestionsJson: z.record(z.any()).optional()
});
