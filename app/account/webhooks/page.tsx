import Link from "next/link";
import { PageShell } from "@/components/app-shell";
import { Panel } from "@/components/cards";
import {
  testNotificationWebhook,
  testResumeTailorWebhook,
  testStatusSyncWebhook,
  updateAgentWebhookSettings
} from "@/app/actions";
import { requireSessionUser } from "@/lib/session";
import { MiniGuide, NoteBlock } from "../_components/account-sections";

export default async function AccountWebhooksPage() {
  const user = await requireSessionUser();

  return (
    <PageShell
      title="Webhook 自动化"
      description="Webhook 适合把站内动作主动推送给外部工作流。也就是：不是外部来拉数据，而是站点在合适的时候把上下文发出去。"
      action={
        <Link href="/account" className="inline-flex rounded-2xl border border-line px-4 py-3 text-sm">
          返回设置首页
        </Link>
      }
    >
      <Panel title="Webhook 配置" subtitle="这一页负责填写出站 URL、设置校验字段，并测试你的自动化链路是否真正接通。">
        <div className="mb-5 space-y-4">
          <MiniGuide
            title="简历微调 Webhook"
            body="当你希望外部简历 Agent 接手微调时使用。站点会把岗位信息、简历正文和补充说明发给你的工作流。"
          />
          <MiniGuide
            title="状态同步 Webhook"
            body="当你希望岗位进展同步到外部系统时使用。适合接 Notion、CRM、飞书表格或你自己的流程平台。"
          />
          <MiniGuide
            title="通知同步 Webhook"
            body="当你希望把站内解析出的面试通知、测评通知等继续分发到别的系统时使用。"
          />
        </div>

        <form action={updateAgentWebhookSettings} className="space-y-4">
          <div className="space-y-4">
            <label className="block text-sm text-slate-600">
              简历微调 Webhook
              <input
                name="resumeTailorWebhookUrl"
                defaultValue={user.resumeTailorWebhookUrl || ""}
                className="mt-2 w-full rounded-2xl border border-line bg-panel px-4 py-3 outline-none"
                placeholder="例如：https://your-n8n/webhook/resume-tailor"
              />
              <span className="mt-2 block text-xs leading-5 text-slate-500">用于把“这份简历要针对这个岗位做微调”的请求推送到外部自动化流程。</span>
            </label>

            <label className="block text-sm text-slate-600">
              状态同步 Webhook
              <input
                name="statusSyncWebhookUrl"
                defaultValue={user.statusSyncWebhookUrl || ""}
                className="mt-2 w-full rounded-2xl border border-line bg-panel px-4 py-3 outline-none"
                placeholder="例如：https://your-n8n/webhook/status-sync"
              />
              <span className="mt-2 block text-xs leading-5 text-slate-500">用于把岗位阶段、申请状态和相关上下文同步到外部系统。</span>
            </label>

            <label className="block text-sm text-slate-600">
              通知同步 Webhook
              <input
                name="notificationWebhookUrl"
                defaultValue={user.notificationWebhookUrl || ""}
                className="mt-2 w-full rounded-2xl border border-line bg-panel px-4 py-3 outline-none"
                placeholder="例如：https://your-n8n/webhook/notifications"
              />
              <span className="mt-2 block text-xs leading-5 text-slate-500">用于把面试通知、测评通知等站内事件继续推送给你自己的处理链路。</span>
            </label>

            <label className="block text-sm text-slate-600">
              Webhook Secret
              <input
                name="webhookSecret"
                defaultValue={user.webhookSecret || ""}
                className="mt-2 w-full rounded-2xl border border-line bg-panel px-4 py-3 outline-none"
                placeholder="可选。你的工作流可以用它校验收到的请求。"
              />
              <span className="mt-2 block text-xs leading-5 text-slate-500">这是给高级用户的安全校验字段。你的工作流收到请求后，可以用它确认这次回调确实来自本站，而不是外部伪造请求。</span>
            </label>
          </div>

          <button className="rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-white">保存 Webhook 设置</button>
        </form>

        <div className="mt-4 space-y-4">
          <NoteBlock title="什么时候需要 Webhook">
            当你希望“站内某个动作一发生，外部系统就自动继续处理”时，就适合配置 Webhook。比如把简历微调请求发给 n8n，把岗位状态同步到 CRM，或把通知事件转发给企业微信流程。
          </NoteBlock>
          <NoteBlock title="怎么验证是否接通">
            保存 URL 后，可以直接使用下面的测试按钮。测试成功通常意味着你的外部工作流地址可访问、路由正确，而且没有被鉴权或字段格式挡住。
          </NoteBlock>
        </div>

        <div className="mt-5 space-y-3">
          <div className="text-sm font-medium text-ink">Webhook 连通性测试</div>
          <div className="flex flex-wrap gap-3">
            <form action={testResumeTailorWebhook}>
              <button className="rounded-2xl border border-line px-4 py-2.5 text-sm font-medium text-ink">测试简历微调 Webhook</button>
            </form>
            <form action={testStatusSyncWebhook}>
              <button className="rounded-2xl border border-line px-4 py-2.5 text-sm font-medium text-ink">测试状态同步 Webhook</button>
            </form>
            <form action={testNotificationWebhook}>
              <button className="rounded-2xl border border-line px-4 py-2.5 text-sm font-medium text-ink">测试通知同步 Webhook</button>
            </form>
          </div>
        </div>
      </Panel>
    </PageShell>
  );
}
