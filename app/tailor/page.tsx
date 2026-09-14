import Link from "next/link";
import { PageShell } from "@/components/app-shell";
import { Panel } from "@/components/cards";

export const dynamic = "force-dynamic";

/** Stable legacy route while the tailoring flow is paused. */
export default function TailorPage() {
  return (
    <PageShell title="Agent 准备" description="该能力正在整理中。你可以先完善候选人资料，并在岗位工作台推进下一步。">
      <Panel title="准备你的下一步" subtitle="主简历确认后，继续在岗位中维护进度、事件和待办。">
        <div className="flex flex-wrap gap-2">
          <Link href="/resumes" className="inline-flex h-10 items-center justify-center rounded-xl bg-ink px-4 text-sm font-medium text-white">查看候选人资料</Link>
          <Link href="/jobs" className="inline-flex h-10 items-center justify-center rounded-xl border border-line bg-white px-4 text-sm font-medium text-ink">前往岗位工作台</Link>
        </div>
      </Panel>
    </PageShell>
  );
}
