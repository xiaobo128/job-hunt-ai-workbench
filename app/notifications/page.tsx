import { PageShell } from "@/components/app-shell";
import { AddNotificationDialog } from "@/components/add-notification-dialog";
import { updateNotificationEvent } from "@/app/actions";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { requireSessionUser } from "@/lib/session";

const eventTypeOptions = [
  { value: "NOTE", label: "备注" },
  { value: "ASSESSMENT", label: "测评" },
  { value: "INTERVIEW", label: "面试" },
  { value: "OFFER", label: "录用" },
  { value: "REJECTION", label: "拒绝" },
  { value: "DEADLINE", label: "截止时间" }
] as const;

export default async function NotificationsPage() {
  const user = await requireSessionUser();
  const [applications, events] = await Promise.all([
    prisma.application.findMany({
      where: {
        currentStage: { not: "CLOSED" },
        jobLead: { ownerId: user.id, status: { not: "CLOSED" } }
      },
      include: {
        jobLead: {
          select: { companyName: true, roleTitle: true }
        }
      },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.event.findMany({
      where: {
        application: {
          currentStage: { not: "CLOSED" },
          jobLead: { ownerId: user.id, status: { not: "CLOSED" } }
        }
      },
      include: {
        application: {
          include: {
            jobLead: {
              select: { id: true, companyName: true, roleTitle: true }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 30
    })
  ]);

  const applicationOptions = applications.map((application) => ({
    id: application.id,
    label: `${application.jobLead.companyName} | ${application.jobLead.roleTitle}`
  }));

  return (
    <PageShell
      title="通知管理"
      description="导入通知后可人工确认或修正；每条记录都会作为申请的 Event 时间线来源。"
      action={<AddNotificationDialog applications={applicationOptions} />}
    >
      <div className="space-y-3">
        {events.length === 0 ? (
          <div className="rounded-3xl border border-line bg-white p-6 text-sm text-slate-500 shadow-card">
            还没有通知记录。可以用右上角按钮先导入第一条。
          </div>
        ) : (
          events.map((event) => {
            const details = readEventDetails(event.detailsJson);
            const detailPreview = buildDetailPreview(details.content, details.requirements);
            const timeLabel = formatDate(event.eventTime || event.createdAt);

            return (
              <details key={event.id} className="group rounded-3xl border border-line bg-white shadow-card">
                <summary className="list-none cursor-pointer p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="truncate text-lg font-semibold text-ink">
                        {event.application.jobLead.companyName} | {event.application.jobLead.roleTitle}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                        <span>{getEventTypeLabel(event.eventType)}</span>
                        <span>{timeLabel}</span>
                        <span>{event.title}</span>
                      </div>
                      {detailPreview ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{detailPreview}</p> : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <ProviderBadge provider={event.aiProvider} />
                      <span className="rounded-full border border-line px-3 py-1 text-xs text-slate-500">点击展开</span>
                    </div>
                  </div>
                </summary>

                <div className="border-t border-line px-4 pb-4 pt-4">
                  <form action={updateNotificationEvent} className="space-y-3 rounded-3xl border border-line bg-slate-50 p-4">
                    <input type="hidden" name="eventId" value={event.id} />
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="block text-sm text-slate-600">
                        通知类型
                        <select
                          name="eventType"
                          defaultValue={event.eventType}
                          className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none"
                        >
                          {eventTypeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-sm text-slate-600">
                        时间
                        <input
                          type="datetime-local"
                          name="eventTime"
                          defaultValue={toDateTimeLocalValue(event.eventTime)}
                          className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none"
                        />
                      </label>
                    </div>

                    <label className="block text-sm text-slate-600">
                      标题
                      <input
                        name="title"
                        defaultValue={event.title}
                        className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none"
                      />
                    </label>

                    <label className="block text-sm text-slate-600">
                      通知正文
                      <textarea
                        name="content"
                        rows={5}
                        defaultValue={details.content}
                        className="mt-2 w-full rounded-3xl border border-line bg-white px-4 py-3 outline-none"
                      />
                    </label>

                    <label className="block text-sm text-slate-600">
                      要求事项 / 后续动作
                      <textarea
                        name="requirementsText"
                        rows={4}
                        defaultValue={details.requirements.join("\n")}
                        className="mt-2 w-full rounded-3xl border border-line bg-white px-4 py-3 outline-none"
                        placeholder="每行一条"
                      />
                    </label>

                    {event.artifactUrl ? (
                      <a
                        href={event.artifactUrl}
                        target="_blank"
                        className="block text-sm text-accent underline-offset-4 hover:underline"
                      >
                        {event.artifactName || "打开附件"}
                      </a>
                    ) : null}

                    <button className="w-full rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-white">保存通知</button>
                  </form>
                </div>
              </details>
            );
          })
        )}
      </div>
    </PageShell>
  );
}

function ProviderBadge({ provider }: { provider: string | null }) {
  const label = provider === "openai" ? "OpenAI" : provider === "external-agent" ? "外部 Agent" : "待确认";

  return <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{label}</span>;
}

function getEventTypeLabel(eventType: string) {
  return eventTypeOptions.find((option) => option.value === eventType)?.label ?? eventType;
}

function readEventDetails(detailsJson: string) {
  try {
    const parsed = JSON.parse(detailsJson) as { content?: unknown; requirements?: unknown };

    return {
      content: typeof parsed.content === "string" ? parsed.content : "",
      requirements: Array.isArray(parsed.requirements)
        ? parsed.requirements.filter((item): item is string => typeof item === "string")
        : []
    };
  } catch {
    return { content: "", requirements: [] as string[] };
  }
}

function buildDetailPreview(content: string, requirements: string[]) {
  const normalizedContent = content.replace(/\s+/g, " ").trim();

  if (normalizedContent) {
    return normalizedContent;
  }

  if (requirements.length > 0) {
    return requirements.join("; ");
  }

  return "";
}

function toDateTimeLocalValue(value: Date | null) {
  if (!value) {
    return "";
  }

  const offsetMs = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
}
