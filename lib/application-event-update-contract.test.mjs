import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const actions = fs.readFileSync(new URL("../app/actions.ts", import.meta.url), "utf8");
const updateAction = actions.slice(
  actions.indexOf("export async function updateNotificationEvent"),
  actions.indexOf("export async function deleteNotificationEvent")
);
const mcp = fs.readFileSync(new URL("./mcp/server.ts", import.meta.url), "utf8");

test("Web Event editing delegates its canonical mutation to updateApplicationEvent", () => {
  assert.match(updateAction, /updateApplicationEvent\s*\(/);
  assert.doesNotMatch(updateAction, /prisma\.event\.(update|create|delete)\s*\(/);
});

test("the Event update MCP capability proposes only and exposes no execution tool", () => {
  assert.match(mcp, /"propose_recruitment_event_update"/);
  assert.doesNotMatch(mcp, /"update_recruitment_event"\s*,/);
});
