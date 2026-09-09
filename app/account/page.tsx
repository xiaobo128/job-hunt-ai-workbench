import Link from "next/link";
import { PageShell } from "@/components/app-shell";
import { Panel } from "@/components/cards";
import { requireSessionUser } from "@/lib/session";
import { accountSections } from "./_components/account-sections";

export default async function AccountPage({
  searchParams
}: {
  searchParams?: Promise<{ createdToken?: string; createdTokenName?: string }>;
}) {
  await requireSessionUser();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const createdToken = resolvedSearchParams?.createdToken || "";
  const createdTokenName = resolvedSearchParams?.createdTokenName || "";

  return (
    <PageShell
      title="账户中心"
      description="先选择要处理的设置模块，再进入对应页面完成详细配置。普通用户通常先看 AI 模型设置；需要自动化接入时，再进入 Agent 与 Webhook 页面。"
      action={
        <Link href="/" className="inline-flex rounded-2xl border border-line px-4 py-3 text-sm">
          返回总览
        </Link>
      }
    >
      {createdToken ? (
        <Panel
          title="新的 API Token 已创建"
          subtitle="这是明文 Token 唯一一次展示。请现在就复制并保存，之后站内只会保留记录和哈希。"
        >
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-sm font-medium text-emerald-900">{createdTokenName || "默认自动化令牌"}</div>
            <div className="mt-3 break-all rounded-xl bg-white px-3 py-3 font-mono text-sm text-emerald-900">{createdToken}</div>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <Link href="/account/agent" className="rounded-2xl bg-emerald-700 px-4 py-2.5 font-medium text-white">
                进入 Agent 接入
              </Link>
              <Link href="/agent-api" className="rounded-2xl border border-emerald-300 px-4 py-2.5 font-medium text-emerald-900">
                查看 API 文档
              </Link>
            </div>
          </div>
        </Panel>
      ) : null}

      <Panel
        title="设置导航"
        subtitle="第一页只保留二级菜单入口。点击卡片进入新的页面查看和修改对应内容。"
      >
        <div className="space-y-3">
          {accountSections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="block rounded-2xl border border-line bg-panel px-5 py-5 transition hover:border-slate-300 hover:bg-white"
            >
              <div className="text-base font-medium text-ink">{section.title}</div>
              <div className="mt-2 text-sm leading-6 text-slate-500">{section.description}</div>
            </Link>
          ))}
        </div>
      </Panel>
    </PageShell>
  );
}
