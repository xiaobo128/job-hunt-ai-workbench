import {
  AgentRunKind,
  AgentRunSource,
  AgentRunStatus,
  ApplicationStage,
  EventType,
  ResumeVariantSourceType,
  SourceType
} from "@prisma/client";
import { NextResponse } from "next/server";
import { getRuntimeConfig } from "@/lib/env";

export async function GET() {
  const runtime = getRuntimeConfig();
  const serverUrl = runtime.appUrl || "http://127.0.0.1:3000";

  const spec = {
    openapi: "3.1.0",
    info: {
      title: "Job Hunt Workbench Agent API",
      version: "1.0.0",
      description:
        "Phase 1 agent integration API for writing jobs, application status, resume variants, events, and tailor results back into the workbench."
    },
    servers: [{ url: serverUrl }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "API Token"
        }
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          required: ["ok", "error"],
          properties: {
            ok: { type: "boolean", const: false },
            error: { type: "string" },
            message: { type: "string" },
            details: { type: "object", additionalProperties: true }
          }
        },
        AgentJobCreateRequest: {
          type: "object",
          required: ["companyName", "roleTitle", "rawContent"],
          properties: {
            companyName: { type: "string" },
            roleTitle: { type: "string" },
            rawContent: { type: "string" },
            city: { type: "string" },
            sourceName: { type: "string" },
            sourceUrl: { type: "string" },
            note: { type: "string" },
            parsedSummary: { type: "string" },
            applicationNote: { type: "string" },
            seniority: { type: "string" },
            salaryRange: { type: "string" },
            sourceType: { type: "string", enum: Object.values(SourceType) },
            initialStage: { type: "string", enum: Object.values(ApplicationStage) },
            status: { type: "string", enum: Object.values(ApplicationStage) },
            skills: { type: "array", items: { type: "string" } },
            requirements: { type: "array", items: { type: "string" } },
            responsibilities: { type: "array", items: { type: "string" } }
          }
        },
        AgentJobCreateResponse: {
          type: "object",
          required: ["ok", "jobLead"],
          properties: {
            ok: { type: "boolean", const: true },
            jobLead: {
              type: "object",
              required: ["id", "companyName", "roleTitle", "status"],
              properties: {
                id: { type: "string" },
                companyName: { type: "string" },
                roleTitle: { type: "string" },
                status: { type: "string", enum: Object.values(ApplicationStage) }
              }
            },
            application: {
              type: "object",
              nullable: true,
              properties: {
                id: { type: "string" },
                currentStage: { type: "string", enum: Object.values(ApplicationStage) }
              }
            }
          }
        },
        AgentApplicationPatchRequest: {
          type: "object",
          properties: {
            currentStage: { type: "string", enum: Object.values(ApplicationStage) },
            stage: { type: "string", enum: Object.values(ApplicationStage) },
            note: { type: ["string", "null"] }
          },
          anyOf: [{ required: ["currentStage"] }, { required: ["stage"] }]
        },
        AgentApplicationPatchResponse: {
          type: "object",
          required: ["ok", "application"],
          properties: {
            ok: { type: "boolean", const: true },
            application: {
              type: "object",
              required: ["id", "currentStage"],
              properties: {
                id: { type: "string" },
                currentStage: { type: "string", enum: Object.values(ApplicationStage) },
                note: { type: ["string", "null"] }
              }
            }
          }
        },
        AgentResumeVariantCreateRequest: {
          type: "object",
          required: ["resumeId", "title"],
          properties: {
            resumeId: { type: "string" },
            jobLeadId: { type: "string" },
            sourceType: { type: "string", enum: Object.values(ResumeVariantSourceType) },
            title: { type: "string" },
            note: { type: "string" },
            fileUrl: { type: "string" },
            artifactName: { type: "string" },
            artifactMimeType: { type: "string" },
            draftText: { type: "string" }
          }
        },
        AgentResumeVariantCreateResponse: {
          type: "object",
          required: ["ok", "resumeVariant"],
          properties: {
            ok: { type: "boolean", const: true },
            resumeVariant: {
              type: "object",
              required: ["id", "title", "sourceType"],
              properties: {
                id: { type: "string" },
                title: { type: "string" },
                sourceType: { type: "string", enum: Object.values(ResumeVariantSourceType) }
              }
            }
          }
        },
        AgentEventCreateRequest: {
          type: "object",
          required: ["applicationId", "eventType", "title"],
          properties: {
            applicationId: { type: "string" },
            eventType: { type: "string", enum: Object.values(EventType) },
            title: { type: "string" },
            eventTime: { type: "string", format: "date-time" },
            content: { type: "string" },
            provider: { type: "string" },
            aiNote: { type: "string" },
            artifactName: { type: "string" },
            artifactUrl: { type: "string" },
            requirements: { type: "array", items: { type: "string" } }
          }
        },
        AgentEventCreateResponse: {
          type: "object",
          required: ["ok", "event"],
          properties: {
            ok: { type: "boolean", const: true },
            event: {
              type: "object",
              required: ["id", "eventType", "title"],
              properties: {
                id: { type: "string" },
                eventType: { type: "string", enum: Object.values(EventType) },
                title: { type: "string" }
              }
            }
          }
        },
        AgentTailorRunCreateRequest: {
          type: "object",
          required: ["resumeId", "jobLeadId", "summary"],
          properties: {
            resumeId: { type: "string" },
            jobLeadId: { type: "string" },
            provider: { type: "string" },
            aiNote: { type: "string" },
            summary: { type: "string" },
            draftTitle: { type: "string" },
            draftText: { type: "string" },
            suggestionsJson: { type: "object", additionalProperties: true }
          }
        },
        AgentTailorRunCreateResponse: {
          type: "object",
          required: ["ok", "tailorRun"],
          properties: {
            ok: { type: "boolean", const: true },
            tailorRun: {
              type: "object",
              required: ["id", "summary"],
              properties: {
                id: { type: "string" },
                summary: { type: "string" }
              }
            }
          }
        },
        AgentRunSummary: {
          type: "object",
          required: ["kind", "source", "status"],
          properties: {
            kind: { type: "string", enum: Object.values(AgentRunKind) },
            source: { type: "string", enum: Object.values(AgentRunSource) },
            status: { type: "string", enum: Object.values(AgentRunStatus) }
          }
        }
      }
    },
    security: [{ bearerAuth: [] }],
    paths: {
      "/api/agent/jobs": {
        post: {
          summary: "Create a job lead and linked application",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AgentJobCreateRequest" }
              }
            }
          },
          responses: buildResponses("#/components/schemas/AgentJobCreateResponse", ["400", "401", "500"])
        }
      },
      "/api/agent/applications/{id}": {
        patch: {
          summary: "Update an application stage and note",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" }
            }
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AgentApplicationPatchRequest" }
              }
            }
          },
          responses: buildResponses("#/components/schemas/AgentApplicationPatchResponse", ["400", "401", "404", "500"])
        }
      },
      "/api/agent/resume-variants": {
        post: {
          summary: "Create a resume variant record",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AgentResumeVariantCreateRequest" }
              }
            }
          },
          responses: buildResponses("#/components/schemas/AgentResumeVariantCreateResponse", ["400", "401", "404", "500"])
        }
      },
      "/api/agent/events": {
        post: {
          summary: "Create an event and optionally sync stage",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AgentEventCreateRequest" }
              }
            }
          },
          responses: buildResponses("#/components/schemas/AgentEventCreateResponse", ["400", "401", "404", "500"])
        }
      },
      "/api/agent/tailor-runs": {
        post: {
          summary: "Write back an external tailor result",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AgentTailorRunCreateRequest" }
              }
            }
          },
          responses: buildResponses("#/components/schemas/AgentTailorRunCreateResponse", ["400", "401", "404", "500"])
        }
      }
    }
  };

  return NextResponse.json(spec);
}

function buildResponses(successSchemaRef: string, errorStatuses: Array<"400" | "401" | "404" | "500">) {
  const responses: Record<string, unknown> = {
    "200": {
      description: "Successful write",
      content: {
        "application/json": {
          schema: { $ref: successSchemaRef }
        }
      }
    }
  };

  for (const status of errorStatuses) {
    responses[status] = {
      description: getStatusDescription(status),
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/ErrorResponse" }
        }
      }
    };
  }

  return responses;
}

function getStatusDescription(status: "400" | "401" | "404" | "500") {
  if (status === "400") {
    return "Validation error";
  }
  if (status === "401") {
    return "Unauthorized";
  }
  if (status === "404") {
    return "Referenced object not found";
  }
  return "Server error";
}
