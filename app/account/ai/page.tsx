import Link from "next/link";
import { PageShell } from "@/components/app-shell";
import { Panel } from "@/components/cards";
import { updateAiSettings } from "@/app/actions";
import { Callout, NoteBlock } from "../_components/account-sections";
import { getAiSettingsDisplay } from "@/lib/ai-settings";
import { requireSessionUser } from "@/lib/session";

export default async function AccountAiPage() {
  const user = await requireSessionUser();
  const aiStatus = getAiSettingsDisplay({
    provider: user.aiProvider,
    apiKey: user.aiApiKey,
    apiBaseUrl: user.aiApiBaseUrl,
    forwardHost: user.aiForwardHost,
    model: user.aiModel,
    visionModel: user.aiVisionModel
  });

  return (
    <PageShell
      title="AI 模型设置"
      description="默认可直接使用站点配置；也可以填写自己的服务覆盖它。"
      action={
        <Link href="/account" className="inline-flex rounded-2xl border border-line px-4 py-3 text-sm">
          返回设置首页
        </Link>
      }
    >
      <Panel title="AI 配置" subtitle="你的自定义设置只会应用于自己的账户。">
        <div className="mb-5 space-y-4">
          <Callout
            title={aiStatus.usesSiteDefault ? "当前使用站点默认 AI 配置" : aiStatus.hasUserApiKey ? "当前使用自己的 AI 配置" : "AI 配置状态"}
            body={
              aiStatus.isConfigured
                ? `当前模型：${aiStatus.model}${aiStatus.baseUrlHost ? ` · ${aiStatus.baseUrlHost}` : ""}。API Key 不会在此页面显示。`
                : "尚未配置可用的 AI 服务。请填写自己的 API Key，或请站点管理员配置默认 AI 服务。"
            }
          />
          <Callout
            title="使用自己的配置（可选）"
            body="填写自己的 API Key 后，岗位和通知解析会优先使用你的配置。只有使用代理、中转服务或兼容接口时，才需要填写 API Base URL 和转发 Host。"
          />
        </div>

        <form action={updateAiSettings} className="space-y-4">
          <div className="space-y-3">
            <label className="block text-sm text-slate-600">
              AI 服务商
              <select
                name="aiProvider"
                defaultValue={user.aiProvider || ""}
                className="mt-2 w-full rounded-2xl border border-line bg-panel px-4 py-3 outline-none"
              >
                <option value="">使用站点默认</option>
                <option value="openai">OpenAI</option>
                <option value="openrouter">OpenRouter</option>
                <option value="custom">自定义兼容接口</option>
              </select>
              <span className="mt-2 block text-xs leading-5 text-slate-500">
                选择你实际购买或正在使用的 AI 服务。OpenAI 适合直接接官方接口；OpenRouter 和自定义接口适合统一路由、代理或中转场景。
              </span>
            </label>

            <label className="block text-sm text-slate-600">
              文本模型
              <input
                name="aiModel"
                defaultValue={user.aiModel || ""}
                className="mt-2 w-full rounded-2xl border border-line bg-panel px-4 py-3 outline-none"
                placeholder={`留空时使用默认模型（当前：${aiStatus.model}）`}
              />
              <span className="mt-2 block text-xs leading-5 text-slate-500">
                这是岗位解析和通知理解优先使用的主模型；留空时沿用站点默认模型。
              </span>
            </label>
          </div>

          <div className="space-y-3">
            <label className="block text-sm text-slate-600">
              视觉 / OCR 模型
              <input
                name="aiVisionModel"
                defaultValue={user.aiVisionModel || ""}
                className="mt-2 w-full rounded-2xl border border-line bg-panel px-4 py-3 outline-none"
                placeholder={`留空时使用默认视觉模型（当前：${aiStatus.visionModel}）`}
              />
              <span className="mt-2 block text-xs leading-5 text-slate-500">
                处理图片、截图或扫描件时会使用这个模型；留空时使用站点默认设置。
              </span>
            </label>

            <label className="block text-sm text-slate-600">
              API Base URL
              <input
                name="aiApiBaseUrl"
                defaultValue={user.aiApiBaseUrl || ""}
                className="mt-2 w-full rounded-2xl border border-line bg-panel px-4 py-3 outline-none"
                placeholder="例如：https://api.openai.com/v1 或 https://openrouter.ai/api/v1"
              />
              <span className="mt-2 block text-xs leading-5 text-slate-500">
                这是接口入口地址。直接使用官方 OpenAI 时通常填官方地址；如果你走代理、OpenRouter 或企业网关，就把对方要求的 API 地址填在这里。
              </span>
            </label>
          </div>

          <div className="space-y-3">
            <label className="block text-sm text-slate-600">
              转发 Host
              <input
                name="aiForwardHost"
                defaultValue={user.aiForwardHost || ""}
                className="mt-2 w-full rounded-2xl border border-line bg-panel px-4 py-3 outline-none"
                placeholder="可选。给代理或中转服务指定 Host，例如 api.openai.com"
              />
              <span className="mt-2 block text-xs leading-5 text-slate-500">
                只有少数代理或中转服务会要求单独指定 Host 头。绝大多数用户可以留空；只有当服务商文档明确要求时再填写，例如
                `api.openai.com`。
              </span>
            </label>

            <label className="block text-sm text-slate-600">
              API Key
              <input
                type="password"
                name="aiApiKey"
                className="mt-2 w-full rounded-2xl border border-line bg-panel px-4 py-3 outline-none"
                placeholder={aiStatus.hasUserApiKey ? "已配置。只有在想替换时才需重新输入。" : "可选：填写后仅对你生效"}
              />
              <span className="mt-2 block text-xs leading-5 text-slate-500">
                这是你的服务凭证。保存后，站内 AI 功能会优先使用它；站点默认密钥不会显示或写入你的账户。
              </span>
            </label>
          </div>

          <div className="rounded-2xl bg-panel px-4 py-3 text-sm text-slate-600">
            当前生效：服务商 {aiStatus.provider} | 文本模型 {aiStatus.model} | 视觉模型 {aiStatus.visionModel}
            {aiStatus.baseUrlHost ? ` | 接口地址 ${aiStatus.baseUrlHost}` : ""}
          </div>

          <div className="space-y-4">
            <NoteBlock title="API Key 状态">
              {aiStatus.hasUserApiKey
                ? "当前已保存自己的 API Key，会优先用于站内 AI 功能。"
                : aiStatus.usesSiteDefault
                  ? "当前使用站点默认配置；无需为开始使用单独填写 API Key。"
                  : "未发现可用的默认 AI 配置。请填写自己的 API Key。"}
            </NoteBlock>
            <NoteBlock title="使用建议">
              使用默认配置即可开始。只有想使用自己的服务或兼容网关时，再填写上方字段。
            </NoteBlock>
          </div>

          {!aiStatus.isConfigured ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              当前没有可用的 AI 配置。请填写自己的 API Key，或联系站点管理员配置默认 AI 服务。
            </div>
          ) : null}

          <div className="text-sm text-slate-600">
            <div className="font-medium text-ink">补充说明</div>
            <ul className="mt-3 space-y-2">
              <li>- 自己填写的配置仅应用于你的账户。</li>
              <li>- OpenRouter 和自定义服务默认按 OpenAI Responses API 兼容方式调用。</li>
              <li>- 请确认所选服务支持 OpenAI Responses API 兼容接口。</li>
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button className="rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-white">保存 AI 设置</button>
            {aiStatus.hasUserOverrides ? (
              <button
                type="submit"
                name="clearAiSettings"
                value="true"
                className="rounded-2xl border border-line px-4 py-3 text-sm font-medium text-slate-700"
              >
                恢复站点默认配置
              </button>
            ) : null}
            <span className="text-sm text-slate-500">保存后会立即影响岗位与通知解析。</span>
          </div>
        </form>
      </Panel>
    </PageShell>
  );
}
