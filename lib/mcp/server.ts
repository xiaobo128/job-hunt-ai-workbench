import { ApplicationStage } from "@prisma/client";
import { createMcpHandler, fromJsonSchema, McpServer } from "@modelcontextprotocol/server";
import { prisma } from "@/lib/db";
import { getCalendarEventDates, getDashboardEventDueAt, resolveEventTime } from "@/lib/event-time";
import { ConfirmedResumeDocumentError, loadConfirmedResumeDocument } from "@/lib/resume-parsing/confirmed";
import { uniqueCriticalEvents } from "@/lib/workflow";

const emptyInput = fromJsonSchema<Record<string, never>>({ type: "object", additionalProperties: false });
const applicationIdInput = fromJsonSchema<{ applicationId: string }>({
  type: "object",
  properties: { applicationId: { type: "string", minLength: 1 } },
  required: ["applicationId"],
  additionalProperties: false
});
const resumeIdInput = fromJsonSchema<{ resumeId: string }>({
  type: "object",
  properties: { resumeId: { type: "string", minLength: 1 } },
  required: ["resumeId"],
  additionalProperties: false
});
const listApplicationsInput = fromJsonSchema<{ stage?: ApplicationStage; company?: string }>({
  type: "object",
  properties: {
    stage: { type: "string", enum: Object.values(ApplicationStage) },
    company: { type: "string", minLength: 1, maxLength: 120 }
  },
  additionalProperties: false
});
const upcomingDeadlinesInput = fromJsonSchema<{ days?: number }>({
  type: "object",
  properties: { days: { type: "integer", minimum: 1, maximum: 31 } },
  additionalProperties: false
});

type JsonObject = Record<string, unknown>;

function date(value: Date | null) {
  return value?.toISOString() ?? null;
}

function safeDetails(detailsJson: string): unknown {
  try {
    return JSON.parse(detailsJson);
  } catch {
    return { content: "", requirements: [] };
  }
}

function result(data: JsonObject) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
    structuredContent: data
  };
}

function error(code: string, message: string) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: code, message }) }],
    isError: true
  };
}

function activeApplicationWhere(userId: string) {
  return {
    currentStage: { notIn: [ApplicationStage.CLOSED, ApplicationStage.REJECTED] },
    jobLead: { ownerId: userId, status: { notIn: [ApplicationStage.CLOSED, ApplicationStage.REJECTED] } }
  };
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export const mcpHandler = createMcpHandler(({ authInfo }) => {
  const userId = authInfo?.clientId;
  const server = new McpServer({ name: "job-hunt-ai-workbench", version: "1.0.0" });

  const requireUserId = () => userId || null;

  server.registerTool(
    "list_applications",
    {
      description: "List the authenticated user's applications with compact matching fields.",
      inputSchema: listApplicationsInput,
      annotations: { readOnlyHint: true }
    },
    async ({ stage, company }) => {
      const authenticatedUserId = requireUserId();
      if (!authenticatedUserId) return error("unauthorized", "Authentication is required.");
      try {
        const applications = await prisma.application.findMany({
          where: {
            ...(stage ? { currentStage: stage } : {}),
            jobLead: {
              ownerId: authenticatedUserId,
              ...(company ? { companyName: { contains: company, mode: "insensitive" } } : {})
            }
          },
          select: {
            id: true,
            currentStage: true,
            appliedAt: true,
            submissionChannel: true,
            nextAction: true,
            nextActionDueAt: true,
            updatedAt: true,
            jobLead: { select: { id: true, companyName: true, roleTitle: true, city: true } }
          },
          orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
          take: 100
        });
        return result({
          applications: applications.map((application) => ({
            applicationId: application.id,
            jobLeadId: application.jobLead.id,
            companyName: application.jobLead.companyName,
            roleTitle: application.jobLead.roleTitle,
            city: application.jobLead.city,
            currentStage: application.currentStage,
            appliedAt: date(application.appliedAt),
            submissionChannel: application.submissionChannel,
            nextAction: application.nextAction,
            nextActionDueAt: date(application.nextActionDueAt),
            updatedAt: application.updatedAt.toISOString()
          }))
        });
      } catch {
        return error("read_failed", "Unable to list applications.");
      }
    }
  );

  server.registerTool(
    "get_application",
    { description: "Get one authenticated user's application, job lead, and event timeline.", inputSchema: applicationIdInput, annotations: { readOnlyHint: true } },
    async ({ applicationId }) => {
      const authenticatedUserId = requireUserId();
      if (!authenticatedUserId) return error("unauthorized", "Authentication is required.");
      try {
        const application = await prisma.application.findFirst({
          where: { id: applicationId, jobLead: { ownerId: authenticatedUserId } },
          select: {
            id: true, currentStage: true, appliedAt: true, submissionChannel: true, nextAction: true, nextActionDueAt: true, note: true, usedResumeId: true, createdAt: true, updatedAt: true,
            jobLead: { select: { id: true, companyName: true, roleTitle: true, city: true, industry: true, sourceName: true, sourceUrl: true, skills: true, responsibilities: true, requirements: true, rawContent: true, parsedSummary: true } },
            events: { select: { id: true, eventType: true, status: true, eventTime: true, windowStartAt: true, deadlineAt: true, receivedAt: true, relativeValidityMinutes: true, title: true, detailsJson: true, artifactName: true, artifactUrl: true, aiProvider: true, aiNote: true, createdAt: true }, orderBy: [{ eventTime: "desc" }, { createdAt: "desc" }, { id: "desc" }] }
          }
        });
        if (!application) return error("not_found", "Application not found.");
        return result({
          application: {
            id: application.id, currentStage: application.currentStage, appliedAt: date(application.appliedAt), submissionChannel: application.submissionChannel, nextAction: application.nextAction, nextActionDueAt: date(application.nextActionDueAt), note: application.note, usedResumeId: application.usedResumeId, createdAt: application.createdAt.toISOString(), updatedAt: application.updatedAt.toISOString()
          },
          jobLead: application.jobLead,
          events: application.events.map((event) => ({
            id: event.id, eventType: event.eventType, status: event.status, eventTime: date(event.eventTime), windowStartAt: date(event.windowStartAt), deadlineAt: date(event.deadlineAt), receivedAt: date(event.receivedAt), relativeValidityMinutes: event.relativeValidityMinutes, title: event.title, details: safeDetails(event.detailsJson), artifactName: event.artifactName, artifactUrl: event.artifactUrl, aiProvider: event.aiProvider, aiNote: event.aiNote, createdAt: event.createdAt.toISOString()
          }))
        });
      } catch {
        return error("read_failed", "Unable to read application.");
      }
    }
  );

  server.registerTool(
    "get_resume",
    { description: "Get the authenticated user's confirmed ResumeDocument only; unconfirmed resume text is never returned.", inputSchema: resumeIdInput, annotations: { readOnlyHint: true } },
    async ({ resumeId }) => {
      const authenticatedUserId = requireUserId();
      if (!authenticatedUserId) return error("unauthorized", "Authentication is required.");
      try {
        const resume = await prisma.resume.findFirst({ where: { id: resumeId, ownerId: authenticatedUserId }, select: { title: true, isPrimary: true } });
        if (!resume) return error("not_found", "Resume not found.");
        const confirmed = await loadConfirmedResumeDocument({ userId: authenticatedUserId, resumeId });
        return result({ resumeId, resumeParseId: confirmed.resumeParseId, title: resume.title, isPrimary: resume.isPrimary, document: confirmed.document });
      } catch (cause) {
        if (cause instanceof ConfirmedResumeDocumentError) return error("confirmed_resume_required", "A confirmed resume is required.");
        return error("read_failed", "Unable to read resume.");
      }
    }
  );

  server.registerTool(
    "get_today_application_events",
    { description: "List the authenticated user's non-ignored active-application events shown on today's dashboard calendar date.", inputSchema: emptyInput, annotations: { readOnlyHint: true } },
    async () => {
      const authenticatedUserId = requireUserId();
      if (!authenticatedUserId) return error("unauthorized", "Authentication is required.");
      try {
        const today = startOfToday();
        const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        const events = await prisma.event.findMany({
          where: { status: { not: "IGNORED" }, application: activeApplicationWhere(authenticatedUserId), OR: [{ eventTime: { not: null } }, { windowStartAt: { not: null } }, { deadlineAt: { not: null } }, { receivedAt: { not: null }, relativeValidityMinutes: { not: null } }] },
          select: { id: true, applicationId: true, eventType: true, status: true, title: true, eventTime: true, windowStartAt: true, deadlineAt: true, receivedAt: true, relativeValidityMinutes: true, application: { select: { jobLead: { select: { companyName: true, roleTitle: true } } } } },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }]
        });
        const todayEvents = events.filter((event) => getCalendarEventDates(event).some((at) => at >= today && at < tomorrow));
        return result({ date: today.toISOString().slice(0, 10), events: todayEvents.map((event) => ({ id: event.id, applicationId: event.applicationId, eventType: event.eventType, status: event.status, title: event.title, eventTime: date(event.eventTime), windowStartAt: date(event.windowStartAt), deadlineAt: date(event.deadlineAt), receivedAt: date(event.receivedAt), relativeValidityMinutes: event.relativeValidityMinutes, companyName: event.application.jobLead.companyName, roleTitle: event.application.jobLead.roleTitle })) });
      } catch {
        return error("read_failed", "Unable to read today's events.");
      }
    }
  );

  server.registerTool(
    "get_upcoming_deadlines",
    { description: "List active application deadlines due today through the requested number of following calendar days (default 7).", inputSchema: upcomingDeadlinesInput, annotations: { readOnlyHint: true } },
    async ({ days = 7 }) => {
      const authenticatedUserId = requireUserId();
      if (!authenticatedUserId) return error("unauthorized", "Authentication is required.");
      try {
        const today = startOfToday();
        const windowEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + days + 1);
        const events = await prisma.event.findMany({
          where: { eventType: "DEADLINE", status: "ACTIVE", application: activeApplicationWhere(authenticatedUserId) },
          select: { id: true, applicationId: true, eventType: true, title: true, eventTime: true, windowStartAt: true, deadlineAt: true, receivedAt: true, relativeValidityMinutes: true, createdAt: true, application: { select: { currentStage: true, jobLead: { select: { id: true, companyName: true, roleTitle: true } } } } },
          orderBy: [{ eventTime: "asc" }, { id: "asc" }]
        });
        const deadlines = uniqueCriticalEvents(events).flatMap((event) => {
          const dueAt = getDashboardEventDueAt(event);
          if (!dueAt || dueAt < today || dueAt >= windowEnd) return [];
          const resolved = resolveEventTime(event);
          return [{ id: event.id, applicationId: event.applicationId, jobLeadId: event.application.jobLead.id, companyName: event.application.jobLead.companyName, roleTitle: event.application.jobLead.roleTitle, currentStage: event.application.currentStage, title: event.title, dueAt: dueAt.toISOString(), effectiveDueReason: resolved.effectiveDueReason, deadlineAt: date(event.deadlineAt), validUntil: date(resolved.validUntil) }];
        }).sort((left, right) => left.dueAt.localeCompare(right.dueAt) || left.id.localeCompare(right.id));
        return result({ startDate: today.toISOString().slice(0, 10), days, deadlines });
      } catch {
        return error("read_failed", "Unable to read upcoming deadlines.");
      }
    }
  );

  return server;
}, { responseMode: "json" });
