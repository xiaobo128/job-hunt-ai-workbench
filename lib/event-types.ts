export const notificationEventTypeOptions = [
  { value: "NOTE", label: "备注" },
  { value: "ASSESSMENT", label: "测评" },
  { value: "WRITTEN_TEST", label: "笔试" },
  { value: "AI_INTERVIEW", label: "AI面" },
  { value: "FIRST_INTERVIEW", label: "一面" },
  { value: "SECOND_INTERVIEW", label: "二面" },
  { value: "THIRD_INTERVIEW", label: "三面" },
  { value: "OFFER", label: "录用" },
  { value: "REJECTION", label: "拒绝" },
  { value: "DEADLINE", label: "截止时间" }
] as const;

const eventTypeLabels: Record<string, string> = {
  NOTE: "备注",
  ASSESSMENT: "测评",
  WRITTEN_TEST: "笔试",
  AI_INTERVIEW: "AI面",
  FIRST_INTERVIEW: "一面",
  SECOND_INTERVIEW: "二面",
  THIRD_INTERVIEW: "三面",
  INTERVIEW: "面试",
  OFFER: "录用",
  REJECTION: "拒绝",
  DEADLINE: "截止时间"
};

export const interviewEventTypes = ["INTERVIEW", "AI_INTERVIEW", "FIRST_INTERVIEW", "SECOND_INTERVIEW", "THIRD_INTERVIEW"] as const;
export const assessmentEventTypes = ["ASSESSMENT", "WRITTEN_TEST"] as const;

export function getEventTypeLabel(eventType: string) {
  return eventTypeLabels[eventType] ?? eventType;
}

export function isInterviewEventType(eventType: string) {
  return interviewEventTypes.includes(eventType as (typeof interviewEventTypes)[number]);
}

export function isAssessmentEventType(eventType: string) {
  return assessmentEventTypes.includes(eventType as (typeof assessmentEventTypes)[number]);
}
