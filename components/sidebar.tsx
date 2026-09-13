"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { logoutUser } from "@/app/auth-actions";

const navItems = [
  { href: "/", label: "首页", icon: "home" },
  { href: "/jobs", label: "我的求职", icon: "briefcase" },
  { href: "/resumes", label: "简历", icon: "fileText" },
  { href: "/tailor", label: "AI 助手", icon: "sparkles" },
  { href: "/account", label: "设置", icon: "settings" }
] as const;

const quickLinks = [{ href: "/notifications", label: "通知管理", icon: "bell" }] as const;

type IconName = (typeof navItems)[number]["icon"] | (typeof quickLinks)[number]["icon"];

function SidebarIcon({ name }: { name: IconName }) {
  const paths = {
    home: <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z" />,
    briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" /></>,
    fileText: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></>,
    sparkles: <><path d="m12 3-1.4 4.6L6 9l4.6 1.4L12 15l1.4-4.6L18 9l-4.6-1.4L12 3ZM19 15l-.7 2.3L16 18l2.3.7L19 21l.7-2.3L22 18l-2.3-.7L19 15ZM5 15l-.7 2.3L2 18l2.3.7L5 21l.7-2.3L8 18l-2.3-.7L5 15Z" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.1 2.1-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-3v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-2.1-2.1.1-.1A1.7 1.7 0 0 0 7 15a1.7 1.7 0 0 0-1.6-1H5.2v-3h.2A1.7 1.7 0 0 0 7 10a1.7 1.7 0 0 0-.3-1.9l-.1-.1 2.1-2.1.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2h3v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 2.1 2.1-.1.1A1.7 1.7 0 0 0 19.4 10a1.7 1.7 0 0 0 1.6 1h.2v3H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
    bell: <><path d="M18 9a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>
  } satisfies Record<IconName, React.ReactNode>;

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5 shrink-0">
      {paths[name]}
    </svg>
  );
}

function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

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
      <div className="mb-5 rounded-2xl bg-ink px-4 py-3 text-white">
        <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/60">AI 求职中枢</div>
        <div className="mt-1 text-lg font-semibold leading-6">求职工作台</div>
        <p className="mt-1 text-xs leading-5 text-white/70">收集、判断、投递和跟进。</p>
      </div>

      <nav aria-label="主要导航" className="space-y-1">
        {navItems.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              aria-current={active ? "page" : undefined}
              className={clsx(
                "flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-medium transition",
                active ? "bg-accent text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-ink"
              )}
            >
              <SidebarIcon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-5 border-t border-line pt-4">
        <div className="px-3 text-xs font-medium text-slate-400">快捷入口</div>
        <nav aria-label="快捷入口" className="mt-2 space-y-1">
          {quickLinks.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "flex h-10 items-center gap-3 rounded-2xl px-3 text-sm transition",
                  active ? "bg-slate-100 font-medium text-ink" : "text-slate-500 hover:bg-slate-100 hover:text-ink"
                )}
              >
                <SidebarIcon name={item.icon} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

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
