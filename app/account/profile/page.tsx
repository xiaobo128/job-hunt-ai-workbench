import Link from "next/link";
import { PageShell } from "@/components/app-shell";
import { Panel, StatCard } from "@/components/cards";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { requireSessionUser } from "@/lib/session";
import { Info } from "../_components/account-sections";

export default async function AccountProfilePage() {
  const user = await requireSessionUser();
  const [jobCount, resumeCount, eventCount, activeSessions] = await Promise.all([
    prisma.jobLead.count({ where: { ownerId: user.id } }),
    prisma.resume.count({ where: { ownerId: user.id } }),
    prisma.event.count({ where: { application: { jobLead: { ownerId: user.id } } } }),
    prisma.session.count({ where: { userId: user.id, expiresAt: { gt: new Date() } } })
  ]);

  return (
    <PageShell
      title="基础账号"
      description="查看账户身份信息、当前工作区概览，以及这个账号正在使用的会话规模。"
      action={
        <Link href="/account" className="inline-flex rounded-2xl border border-line px-4 py-3 text-sm">
          返回设置首页
        </Link>
      }
    >
      <Panel title="工作区概览" subtitle="帮助你快速了解当前账号在这个工作区里累计了多少内容。">
        <div className="space-y-4">
          <StatCard label="岗位数" value={String(jobCount)} hint="当前工作区里保存的岗位线索数量" />
          <StatCard label="原始简历" value={String(resumeCount)} hint="简历仓库里管理的原始简历记录数量" />
          <StatCard label="事件数" value={String(eventCount)} hint="已解析或手动添加的面试、通知事件数量" />
          <StatCard label="活跃会话" value={String(activeSessions)} hint="当前仍然有效的登录会话数量" />
        </div>
      </Panel>

      <Panel title="账号资料" subtitle="这是当前工作区绑定的基础身份信息。">
        <div className="space-y-4">
          <Info label="姓名">{user.name || "未设置"}</Info>
          <Info label="邮箱">{user.email}</Info>
          <Info label="创建时间">{formatDate(user.createdAt)}</Info>
          <Info label="更新时间">{formatDate(user.updatedAt)}</Info>
        </div>
      </Panel>
    </PageShell>
  );
}
