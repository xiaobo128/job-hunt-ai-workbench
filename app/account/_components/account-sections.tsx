import Link from "next/link";
import { Panel } from "@/components/cards";

export const accountSections = [
  {
    href: "/account/profile",
    title: "基础账号",
    description: "查看账号资料、工作区概览和使用规模。"
  },
  {
    href: "/account/ai",
    title: "AI 模型设置",
    description: "设置站内 AI 功能使用的服务商、模型和密钥。"
  },
  {
    href: "/account/agent",
    title: "Agent 接入",
    description: "生成 Token，并把外部脚本、n8n 或 Agent 接进来。"
  },
  {
    href: "/account/webhooks",
    title: "Webhook 自动化",
    description: "把站内动作主动推送到你的外部工作流。"
  },
  {
    href: "/account/status",
    title: "服务状态",
    description: "查看部署可用性与最近自动化运行情况。"
  }
] as const;

export function AccountSubnav({ currentHref }: { currentHref: string }) {
  return (
    <Panel title="账户设置" subtitle="在不同设置模块之间快速切换。">
      <div className="space-y-3">
        <Link
          href="/account"
          className={`block rounded-2xl border px-4 py-3 text-sm font-medium transition ${
            currentHref === "/account"
              ? "border-ink bg-ink text-white"
              : "border-line bg-panel text-ink hover:border-slate-300 hover:bg-white"
          }`}
        >
          设置首页
        </Link>
        {accountSections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className={`block rounded-2xl border px-4 py-3 text-sm font-medium transition ${
              currentHref === section.href
                ? "border-ink bg-ink text-white"
                : "border-line bg-panel text-ink hover:border-slate-300 hover:bg-white"
            }`}
          >
            {section.title}
          </Link>
        ))}
      </div>
    </Panel>
  );
}

export function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-panel p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-2 text-sm text-ink">{children}</div>
    </div>
  );
}

export function RuntimeItem({
  label,
  value,
  ready
}: {
  label: string;
  value: string;
  ready: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-ink">{label}</div>
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
            ready ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          {ready ? "已就绪" : "待完善"}
        </span>
      </div>
      <div className="mt-2 text-sm text-slate-600">{value}</div>
    </div>
  );
}

export function Callout({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-b border-line pb-4 last:border-b-0">
      <div className="text-sm font-medium text-ink">{title}</div>
      <div className="mt-2 text-sm leading-6 text-slate-600">{body}</div>
    </div>
  );
}

export function NoteBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-line pb-4 text-sm text-slate-600 last:border-b-0">
      <div className="font-medium text-ink">{title}</div>
      <div className="mt-2 leading-6">{children}</div>
    </div>
  );
}

export function MiniGuide({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-b border-line pb-4 last:border-b-0">
      <div className="text-sm font-medium text-ink">{title}</div>
      <div className="mt-2 text-sm leading-6 text-slate-600">{body}</div>
    </div>
  );
}
