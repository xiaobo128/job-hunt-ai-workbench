import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildJobHuntOverview } from "./job-hunt-overview";

test("buildJobHuntOverview returns stable empty arrays for an empty dashboard", () => {
  const overview = buildJobHuntOverview({
    progress: { readyToApply: 0, applied: 0, assessment: 0, aiInterview: 0, offer: 0 },
    todayActionItems: [],
    upcomingEvents: []
  }, new Date("2026-10-06T08:00:00.000Z"));

  assert.deepEqual(overview, {
    generatedAt: "2026-10-06T08:00:00.000Z",
    progress: { readyToApply: 0, applied: 0, assessment: 0, aiInterview: 0, offer: 0 },
    actionItems: [],
    upcomingEvents: []
  });
});

test("buildJobHuntOverview serializes shared dashboard action and event facts", () => {
  const overview = buildJobHuntOverview({
    progress: { readyToApply: 1, applied: 2, assessment: 3, aiInterview: 4, offer: 5 },
    todayActionItems: [{
      id: "schedule:event-1",
      href: "/notifications/application-1",
      applicationId: "application-1",
      sourceType: "EVENT",
      eventId: "event-1",
      eventType: "AI_INTERVIEW",
      companyName: "Example Co",
      roleTitle: "Product Manager",
      stage: "AI_INTERVIEW",
      reason: "即将参加面试",
      timeLabel: "安排时间",
      displayTime: "10/7 09:00",
      timeAt: new Date("2026-10-07T09:00:00.000Z"),
      priority: 2,
      taskStatus: "ACTIVE"
    }],
    upcomingEvents: [{
      id: "event-1",
      applicationId: "application-1",
      eventType: "AI_INTERVIEW",
      status: "ACTIVE",
      dueAt: new Date("2026-10-07T09:00:00.000Z"),
      eventTime: new Date("2026-10-07T09:00:00.000Z"),
      windowStartAt: null,
      deadlineAt: null,
      receivedAt: null,
      relativeValidityMinutes: null,
      application: { jobLead: { companyName: "Example Co", roleTitle: "Product Manager" } }
    }]
  }, new Date("2026-10-06T08:00:00.000Z"));

  assert.deepEqual(overview.actionItems[0], {
    applicationId: "application-1",
    companyName: "Example Co",
    roleTitle: "Product Manager",
    stage: "AI_INTERVIEW",
    sourceType: "EVENT",
    reason: "即将参加面试",
    displayTime: "10/7 09:00",
    taskStatus: "ACTIVE",
    timeAt: "2026-10-07T09:00:00",
    eventId: "event-1",
    eventType: "AI_INTERVIEW"
  });
  assert.equal(overview.upcomingEvents[0].dueAt, "2026-10-07T09:00:00");
  assert.equal(overview.upcomingEvents[0].eventId, "event-1");
});
