import Link from "next/link";
import { PageShell } from "@/components/app-shell";
import { Panel } from "@/components/cards";
import { createApiToken, revokeApiToken } from "@/app/actions";
import { prisma } from "@/lib/db";
import { getRuntimeConfig } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { requireSessionUser } from "@/lib/session";
import { Callout } from "../_components/account-sections";

export default async function AccountAgentPage() {
  const user = await requireSessionUser();
  const runtime = getRuntimeConfig();
  const apiTokens = await prisma.apiToken.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" }
  });
  const baseUrl = runtime.appUrl || "http://127.0.0.1:3000";

  return (
    <PageShell
      title="Agent 接入"
      description="面向需要把外部脚本、n8n、Agent 或自动化平台接入站内数据的用户。只在你确实需要自动化写回或批量同步时再配置。"
      action={
        <Link href="/account" className="inline-flex rounded-2xl border border-line px-4 py-3 text-sm">
          返回设置首页
        </Link>
      }
    >
      <Panel title="Agent 与 API Token" subtitle="这一页负责生成凭证、查看现有 Token，并引导你进入完整接口文档。">
        <div className="mb-5 space-y-4">
          <Callout
            title="普通用户可以怎么理解"
            body="如果你只是自己在网页里投递、整理岗位和微调简历，这部分可以先不看。它不是基础功能必填项，而是给想把外部自动化工作流接进来的高级入口。"
          />
          <Callout
            title="Agent Token 有什么风险"
            body="API Token 相当于一把可以代表你访问账户数据的钥匙。拿到它的人，能以你的身份调用已开放的接口，读取或写入你的岗位、简历版本、事件和 Agent 结果。因此只应保存到受信任的工作流平台，怀疑泄漏时立即撤销并重新生成。"
          />
        </div>

        <div className="space-y-4 text-sm text-slate-600">
          <div>
            <div className="font-medium text-ink">接入方式</div>
            <div className="mt-2">
              基础地址：<span className="font-mono text-ink">{baseUrl}</span>
            </div>
            <div className="mt-2">推荐做法是先在这里创建一个 API Token，再把它作为 Bearer Token 配到你的 n8n 工作流、脚本或 Agent 里。</div>
            <div className="mt-2">提交创建后，系统会回到账户设置首页展示一次性 Token 明文，请在那一页立即复制保存。</div>
          </div>

          <div>
            <div className="font-medium text-ink">相关入口</div>
            <div className="mt-3 space-y-2">
              <div>
                <Link href="/agent-api" className="text-accent underline-offset-4 hover:underline">
                  查看完整 Agent API 文档
                </Link>
              </div>
              <div>
                <Link href="/api/agent/openapi" className="text-accent underline-offset-4 hover:underline">
                  打开 OpenAPI JSON
                </Link>
              </div>
              <div className="text-xs leading-5 text-slate-500">文档页更适合高级用户接入；账户页主要负责生成凭证、配置出站和查看运行状态。</div>
            </div>
          </div>
        </div>

        <form action={createApiToken} className="mt-4 rounded-2xl border border-line p-4">
          <div className="text-sm font-medium text-ink">创建 API Token</div>
          <label className="mt-3 block text-sm text-slate-600">
            Token 名称
            <input
              name="name"
              className="mt-2 w-full rounded-2xl border border-line bg-panel px-4 py-3 outline-none"
              placeholder="例如：n8n 同步 / 邮件 Agent / 本地脚本"
            />
            <span className="mt-2 block text-xs leading-5 text-slate-500">建议按用途命名，方便以后识别和撤销，比如“n8n 同步”“邮件 Agent”“本地测试脚本”。</span>
          </label>
          <button className="mt-3 rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-white">生成 Token</button>
        </form>

        <div className="mt-4 space-y-3">
          <div className="text-sm font-medium text-ink">现有 Token</div>
          {apiTokens.length === 0 ? (
            <div className="rounded-2xl bg-panel px-4 py-3 text-sm text-slate-500">还没有创建任何 API Token。</div>
          ) : (
            apiTokens.map((token) => (
              <div key={token.id} className="rounded-2xl border border-line p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-sm font-medium text-ink">{token.name}</div>
                    <div className="mt-1 text-sm text-slate-500">
                      创建于 {formatDate(token.createdAt)}
                      {token.lastUsedAt ? ` | 最近使用 ${formatDate(token.lastUsedAt)}` : " | 还未使用"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{token.revokedAt ? "已撤销" : "有效中"}</div>
                  </div>
                  {!token.revokedAt ? (
                    <form action={revokeApiToken}>
                      <input type="hidden" name="tokenId" value={token.id} />
                      <button className="rounded-2xl border border-line px-4 py-2.5 text-sm font-medium text-ink">撤销</button>
                    </form>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>
    </PageShell>
  );
}
