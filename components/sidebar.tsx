"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { logoutUser } from "@/app/auth-actions";

const navItems = [
  { href: "/", label: "总览" },
  { href: "/jobs", label: "岗位工作台" },
  { href: "/resumes", label: "简历仓库" },
  { href: "/tailor", label: "简历微调" },
  { href: "/notifications", label: "通知管理" },
  { href: "/account", label: "账户中心" }
];

export function Sidebar({
  currentUser
}: {
  currentUser: {
    name: string | null;
    email: string;
  } | null;
}) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-[240px] shrink-0 rounded-3xl border border-line bg-white/80 p-4 shadow-card backdrop-blur md:flex md:flex-col">
      <div className="mb-8 rounded-2xl bg-ink p-4 text-white">
        <div className="text-xs uppercase tracking-[0.24em] text-white/60">AI 求职中枢</div>
        <div className="mt-2 text-2xl font-semibold">求职工作台</div>
        <p className="mt-2 text-sm text-white/70">围绕岗位做收集、判断、投递和跟进。</p>
      </div>

      <nav className="space-y-1">
        {navItems.map((item) => {
          const active = item.href === "/" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              className={clsx(
                "block rounded-2xl px-4 py-3 text-sm transition",
                active ? "bg-accent text-white" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {currentUser ? (
        <div className="mt-auto rounded-2xl border border-line bg-panel p-4">
          <div className="text-sm font-medium text-ink">{currentUser.name || "未命名用户"}</div>
          <div className="mt-1 text-xs text-slate-500">{currentUser.email}</div>
          <form action={logoutUser} className="mt-4">
            <button className="w-full rounded-2xl bg-white px-3 py-2 text-sm font-medium text-ink ring-1 ring-line">
              退出登录
            </button>
          </form>
        </div>
      ) : null}
    </aside>
  );
}
