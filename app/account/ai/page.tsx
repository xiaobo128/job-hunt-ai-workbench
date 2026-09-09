import Link from "next/link";
import { PageShell } from "@/components/app-shell";
import { Panel } from "@/components/cards";
import { updateAiSettings } from "@/app/actions";
import { Callout, NoteBlock } from "../_components/account-sections";
import { requireSessionUser } from "@/lib/session";

export default async function AccountAiPage() {
  const user = await requireSessionUser();
  const effectiveProvider = user.aiProvider || "openai";
  const effectiveApiBaseUrl = user.aiApiBaseUrl || "";
  const effectiveForwardHost = user.aiForwardHost || "";
  const effectiveModel = user.aiModel || process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const effectiveVisionModel = user.aiVisionModel || process.env.OPENAI_VISION_MODEL || effectiveModel;
  const hasUserAiKey = Boolean(user.aiApiKey);

  return (
    <PageShell
      title="AI 模型设置"
      description="决定站内岗位解析、通知解析和简历微调优先使用哪套 AI 配置。普通用户通常只需要填服务商、模型和 API Key。"
      action={
        <Link href="/account" className="inline-flex rounded-2xl border border-line px-4 py-3 text-sm">
          返回设置首页
        </Link>
      }
    >
      <Panel title="AI 配置" subtitle="这里保存的是用户级 AI 设置，不需要修改线上环境变量。">
        <div className="mb-5 space-y-4">
          <Callout
            title="这部分是做什么的"
            body="当你在站内使用岗位解析、通知解析或简历微调时，系统会优先读取这里保存的用户级 AI 配置，而不是依赖部署时写好的环境变量。这样同一套站点可以由不同用户使用各自的模型和密钥。"
          />
          <Callout
            title="普通用户怎么填"
            body="如果你只是想把站内 AI 功能先用起来，通常只需要选择服务商、填写文本模型，并粘贴对应的 API Key。只有在你使用代理、中转服务或兼容接口时，才需要再填写 API Base URL 和转发 Host。"
          />
        </div>

        <form action={updateAiSettings} className="space-y-4">
          <div className="space-y-3">
            <label className="block text-sm text-slate-600">
              AI 服务商
              <select
                name="aiProvider"
                defaultValue={effectiveProvider}
                className="mt-2 w-full rounded-2xl border border-line bg-panel px-4 py-3 outline-none"
              >
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
                defaultValue={effectiveModel}
                className="mt-2 w-full rounded-2xl border border-line bg-panel px-4 py-3 outline-none"
                placeholder="例如：gpt-4.1-mini / openai/gpt-4.1-mini / deepseek-chat"
              />
              <span className="mt-2 block text-xs leading-5 text-slate-500">
                这是岗位解析、通知理解和简历改写优先使用的主模型。大多数场景填一个稳定的通用文本模型就够了。
              </span>
            </label>
          </div>

          <div className="space-y-3">
            <label className="block text-sm text-slate-600">
              视觉 / OCR 模型
              <input
                name="aiVisionModel"
                defaultValue={effectiveVisionModel}
                className="mt-2 w-full rounded-2xl border border-line bg-panel px-4 py-3 outline-none"
                placeholder="留空时默认跟随文本模型"
              />
              <span className="mt-2 block text-xs leading-5 text-slate-500">
                只有在你需要处理图片、截图、扫描件或 OCR 提取时，这个字段才会明显影响结果。留空时会跟随上面的文本模型。
              </span>
            </label>

            <label className="block text-sm text-slate-600">
              API Base URL
              <input
                name="aiApiBaseUrl"
                defaultValue={effectiveApiBaseUrl}
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
                defaultValue={effectiveForwardHost}
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
                placeholder={hasUserAiKey ? "已配置。只有在你想替换时才需要重新输入。" : "例如：sk-..."}
              />
              <span className="mt-2 block text-xs leading-5 text-slate-500">
                这是你的服务凭证。保存后，站内 AI 功能会优先用这把密钥发起请求。更换服务商账号或怀疑密钥泄漏时，建议立即替换。
              </span>
            </label>
          </div>

          <div className="rounded-2xl bg-panel px-4 py-3 text-sm text-slate-600">
            当前生效：服务商 {effectiveProvider} | 文本模型 {effectiveModel} | 视觉模型 {effectiveVisionModel}
            {effectiveForwardHost ? ` | 转发 Host ${effectiveForwardHost}` : ""}
          </div>

          <div className="space-y-4">
            <NoteBlock title="API Key 状态">
              {hasUserAiKey
                ? "当前用户级 API Key 已保存。岗位解析、通知解析和简历微调会优先使用这套配置。"
                : "当前用户级 API Key 还没有保存。即使你已经选了服务商和模型，解析也可能继续回退到环境变量或本地降级模式。"}
            </NoteBlock>
            <NoteBlock title="使用建议">
              普通用户先完成“服务商 + 文本模型 + API Key”即可。只有在你明确使用兼容网关、代理地址或企业中转时，才需要额外填写 API Base URL 和转发 Host。
            </NoteBlock>
          </div>

          {!hasUserAiKey ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              如果你刚从旧版本切过来，请重新输入一次 API Key 再保存，这样用户级 AI 配置才会真正生效。
            </div>
          ) : null}

          <div className="text-sm text-slate-600">
            <div className="font-medium text-ink">补充说明</div>
            <ul className="mt-3 space-y-2">
              <li>- 这套配置是按用户保存的，不会要求你去改线上环境变量。</li>
              <li>- OpenRouter 和自定义服务默认按 OpenAI Responses API 兼容方式调用。</li>
              <li>- 如果你的服务不是 Responses API 兼容接口，当前版本可能还不能直接使用。</li>
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button className="rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-white">保存 AI 设置</button>
            <span className="text-sm text-slate-500">保存后会立即影响岗位解析、通知解析和站内简历微调。</span>
          </div>
        </form>
      </Panel>
    </PageShell>
  );
}
