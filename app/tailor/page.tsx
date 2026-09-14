import Link from "next/link";
import { PageShell } from "@/components/app-shell";
import { Panel } from "@/components/cards";

export const dynamic = "force-dynamic";

export default function TailorPage() {
  return (
    <PageShell title="Agent 准备" description="从具体岗位进入 Agent 准备，获得完整的岗位、进度和事件上下文。">
      <Panel title="选择一个岗位" subtitle="完善候选人资料后，在岗位详情中选择准备任务并复制上下文。">
        <div className="flex flex-wrap gap-2">
          <Link href="/resumes" className="inline-flex h-10 items-center justify-center rounded-xl bg-ink px-4 text-sm font-medium text-white">查看候选人资料</Link>
          <Link href="/jobs" className="inline-flex h-10 items-center justify-center rounded-xl border border-line bg-white px-4 text-sm font-medium text-ink">前往岗位工作台</Link>
        </div>
      </Panel>
    </PageShell>
  );
}
