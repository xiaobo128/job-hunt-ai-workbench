"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { logoutUser } from "@/app/auth-actions";

const navItems = [
  { href: "/", label: "首页", icon: "home" },
  { href: "/jobs", label: "我的求职", icon: "briefcase" },
  { href: "/resumes", label: "我的简历", icon: "fileText" },
  { href: "/notifications", label: "通知管理", icon: "bell" }
] as const;

type IconName = (typeof navItems)[number]["icon"];

function SidebarIcon({ name }: { name: IconName }) {
  const paths = {
    home: <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z" />,
    briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" /></>,
    fileText: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></>,
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
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountActive = isActivePath(pathname, "/account");

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountMenuOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setAccountMenuOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-[240px] shrink-0 rounded-3xl border border-line bg-white/80 p-4 shadow-card backdrop-blur md:flex md:flex-col">
      <div className="mb-5 rounded-2xl bg-ink px-4 py-3 text-white">
        <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/60">个人求职管理</div>
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

      <div ref={accountMenuRef} className="relative mt-auto border-t border-line pt-3">
        {accountMenuOpen ? (
          <div role="menu" aria-label="账号菜单" className="absolute inset-x-0 bottom-full mb-2 rounded-2xl border border-line bg-white p-2 shadow-card">
            <Link
              href="/account"
              role="menuitem"
              prefetch
              onClick={() => setAccountMenuOpen(false)}
              className={clsx(
                "flex rounded-xl px-3 py-2 text-sm font-medium transition",
                accountActive ? "bg-slate-100 text-ink" : "text-slate-600 hover:bg-slate-100 hover:text-ink"
              )}
            >
              设置
            </Link>
            <form action={logoutUser}>
              <button role="menuitem" className="flex w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-ink">
                退出登录
              </button>
            </form>
          </div>
        ) : null}
        <button
          type="button"
          aria-expanded={accountMenuOpen}
          aria-haspopup="menu"
          onClick={() => setAccountMenuOpen((open) => !open)}
          className={clsx(
            "flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left transition",
            accountActive || accountMenuOpen ? "bg-slate-100 text-ink" : "text-slate-500 hover:bg-slate-100 hover:text-ink"
          )}
        >
          <span>
            <span className="block text-sm font-medium">账号</span>
            {currentUser ? <span className="mt-0.5 block text-xs text-slate-400">{currentUser.email}</span> : null}
          </span>
          <span aria-hidden="true" className={clsx("text-xs transition-transform", accountMenuOpen && "rotate-180")}>⌃</span>
        </button>
      </div>
    </aside>
  );
}
