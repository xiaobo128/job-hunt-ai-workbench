import assert from "node:assert/strict";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const endpoint = process.env.MCP_SMOKE_URL;
const token = process.env.MCP_SMOKE_TOKEN;
const resumeId = process.env.MCP_SMOKE_RESUME_ID;
const unconfirmedResumeId = process.env.MCP_SMOKE_UNCONFIRMED_RESUME_ID;

if (!endpoint || !token || !resumeId) {
  throw new Error("MCP_SMOKE_URL, MCP_SMOKE_TOKEN, and MCP_SMOKE_RESUME_ID are required.");
}

const client = new Client({ name: "job-hunt-ai-workbench-smoke", version: "1.0.0" });
const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
  requestInit: { headers: { Authorization: `Bearer ${token}` } }
});

await client.connect(transport);

function errorCode(response) {
  assert.equal(response.isError, true);
  const text = response.content?.find((item) => item.type === "text")?.text;
  assert.ok(text, "error responses must include a text payload");
  return JSON.parse(text).error;
}

const { tools } = await client.listTools();
assert.deepEqual(tools.map((tool) => tool.name).sort(), [
  "get_application",
  "get_resume",
  "get_today_application_events",
  "get_upcoming_deadlines",
  "list_applications"
]);

const listed = await client.callTool({ name: "list_applications", arguments: {} });
assert.equal(listed.isError, undefined);
const applications = listed.structuredContent?.applications;
assert.ok(Array.isArray(applications), "list_applications must return an applications array");
assert.ok(applications.length > 0, "authenticated smoke user must have an application for get_application");

const application = await client.callTool({ name: "get_application", arguments: { applicationId: applications[0].applicationId } });
assert.equal(application.isError, undefined);
assert.equal(application.structuredContent?.application?.id, applications[0].applicationId);

const todayEvents = await client.callTool({ name: "get_today_application_events", arguments: {} });
assert.equal(todayEvents.isError, undefined);
assert.ok(Array.isArray(todayEvents.structuredContent?.events), "get_today_application_events must return an events array");

const upcomingDeadlines = await client.callTool({ name: "get_upcoming_deadlines", arguments: {} });
assert.equal(upcomingDeadlines.isError, undefined);
assert.equal(upcomingDeadlines.structuredContent?.days, 7);
assert.ok(Array.isArray(upcomingDeadlines.structuredContent?.deadlines), "get_upcoming_deadlines must return a deadlines array");

const resume = await client.callTool({ name: "get_resume", arguments: { resumeId } });
assert.equal(resume.isError, undefined);
assert.equal(resume.structuredContent?.resumeId, resumeId);

const missingApplication = await client.callTool({ name: "get_application", arguments: { applicationId: "mcp-smoke-missing-application" } });
assert.equal(errorCode(missingApplication), "not_found");

const missingResume = await client.callTool({ name: "get_resume", arguments: { resumeId: "mcp-smoke-missing-resume" } });
assert.equal(errorCode(missingResume), "not_found");

if (unconfirmedResumeId) {
  const unconfirmedResume = await client.callTool({ name: "get_resume", arguments: { resumeId: unconfirmedResumeId } });
  assert.equal(errorCode(unconfirmedResume), "confirmed_resume_required");
  assert.equal(unconfirmedResume.structuredContent, undefined, "unconfirmed resume must not return a document or raw text");
}

await client.close();
console.log(JSON.stringify({
  tools: tools.map((tool) => tool.name),
  applications: applications.length,
  confirmedResumeId: resumeId,
  getApplication: "ok",
  todayApplicationEvents: "ok",
  upcomingDeadlines: "ok",
  missingApplication: "not_found",
  missingResume: "not_found",
  unconfirmedResume: unconfirmedResumeId ? "confirmed_resume_required" : "not_checked"
}));
