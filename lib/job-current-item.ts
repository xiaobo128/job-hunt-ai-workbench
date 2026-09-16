type CurrentItemSource = "nextAction" | "event" | "empty";

type JobEventForCurrentItem = {
  eventType: string;
  title: string;
};

export function getCurrentJobItem(application: { nextAction: string | null; events: JobEventForCurrentItem[] } | null): { source: CurrentItemSource; text: string } {
  const nextAction = application?.nextAction?.trim();
  if (nextAction) return { source: "nextAction", text: nextAction };

  const events = application?.events ?? [];
  const event = events.find((item) => item.eventType !== "NOTE") ?? events[0];
  if (event?.title.trim()) return { source: "event", text: event.title.trim() };

  return { source: "empty", text: "" };
}
