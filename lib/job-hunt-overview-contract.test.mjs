import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const queries = fs.readFileSync(new URL("./queries.ts", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const mcpServer = fs.readFileSync(new URL("./mcp/server.ts", import.meta.url), "utf8");

test("Web and MCP overview share the user-scoped dashboard read model", () => {
  assert.match(queries, /getDashboardData\(\)[\s\S]*requireSessionUser\(\)[\s\S]*getDashboardDataForUser\(user\.id\)/);
  assert.match(page, /await getDashboardData\(\)/);

  const overviewTool = mcpServer.slice(
    mcpServer.indexOf('"get_job_hunt_overview"'),
    mcpServer.indexOf('"list_applications"')
  );
  assert.match(overviewTool, /getDashboardDataForUser\(authenticatedUserId\)/);
  assert.match(overviewTool, /readOnlyHint:\s*true/);
  assert.match(overviewTool, /destructiveHint:\s*false/);
  assert.doesNotMatch(overviewTool, /prisma\.|createAgentProposal|\.create\(|\.update\(|\.delete\(/);
});

test("shared dashboard ownership, active filtering, time resolution, and deduplication stay centralized", () => {
  const sharedReadModel = queries.slice(queries.indexOf("export async function getDashboardDataForUser"), queries.indexOf("export async function getJobs"));
  assert.match(sharedReadModel, /ownerId:\s*userId/);
  assert.match(sharedReadModel, /currentStage:\s*\{\s*notIn:\s*\[ApplicationStage\.CLOSED, ApplicationStage\.REJECTED\]/);
  assert.match(sharedReadModel, /status:\s*\{\s*notIn:\s*\[ApplicationStage\.CLOSED, ApplicationStage\.REJECTED\]/);
  assert.match(sharedReadModel, /todayActionItems:\s*sortRecentTaskItems\(todayActionItems\)/);
  assert.match(sharedReadModel, /uniqueCriticalEvents\(deadlineEvents\)/);
  assert.match(sharedReadModel, /uniqueCriticalEvents\(scheduleEvents\)/);
  assert.match(sharedReadModel, /getDashboardEventDueAt\(event\)/);
});
