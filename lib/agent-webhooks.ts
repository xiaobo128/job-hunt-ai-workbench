import { AgentRunKind, AgentRunSource, AgentRunStatus } from "@prisma/client";
import { completeAgentRunLog, createAgentRunLog } from "@/lib/agent-auth";

type OutboundWebhookParams = {
  user: {
    id: string;
    webhookSecret: string | null;
  };
  webhookUrl: string | null;
  kind: AgentRunKind;
  input: unknown;
  related?: {
    jobLeadId?: string | null;
    resumeId?: string | null;
    resumeVariantId?: string | null;
    eventId?: string | null;
  };
};

export async function triggerOutboundWebhook({
  user,
  webhookUrl,
  kind,
  input,
  related
}: OutboundWebhookParams) {
  const run = await createAgentRunLog({
    userId: user.id,
    kind,
    source: AgentRunSource.WEBHOOK,
    status: AgentRunStatus.PENDING,
    input,
    ...related
  });

  if (!webhookUrl) {
    await completeAgentRunLog({
      agentRunId: run.id,
      status: AgentRunStatus.FAILED,
      errorMessage: "未配置对应的外部 webhook 地址。"
    });
    return { ok: false, runId: run.id, error: "missing_webhook" as const };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(user.webhookSecret ? { "X-Job-Workbench-Secret": user.webhookSecret } : {})
      },
      body: JSON.stringify(input)
    });
    const responseText = await response.text();

    if (!response.ok) {
      await completeAgentRunLog({
        agentRunId: run.id,
        status: AgentRunStatus.FAILED,
        output: {
          status: response.status,
          body: responseText.slice(0, 4000)
        },
        errorMessage: `Webhook 调用失败：${response.status}`
      });
      return { ok: false, runId: run.id, error: "http_error" as const };
    }

    await completeAgentRunLog({
      agentRunId: run.id,
      status: AgentRunStatus.SUCCEEDED,
      output: {
        status: response.status,
        body: responseText.slice(0, 4000)
      }
    });

    return { ok: true, runId: run.id };
  } catch (error) {
    await completeAgentRunLog({
      agentRunId: run.id,
      status: AgentRunStatus.FAILED,
      errorMessage: error instanceof Error ? error.message : "Webhook 调用异常"
    });
    return { ok: false, runId: run.id, error: "network_error" as const };
  }
}
