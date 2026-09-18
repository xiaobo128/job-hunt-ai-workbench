"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { logoutUser } from "@/app/auth-actions";
import { isActivePath, navItems, NavIcon } from "@/components/nav-config";

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
    <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-[232px] shrink-0 border-r border-line bg-white px-3 py-3 md:flex md:flex-col">
      <div className="mb-4 px-2 py-2">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">个人求职管理</div>
        <div className="mt-1 text-base font-semibold leading-5 text-ink">求职工作台</div>
        <p className="mt-1 text-xs leading-4 text-slate-500">收集、判断、投递和跟进。</p>
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
                "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-colors",
                active ? "bg-slate-100 text-ink" : "text-slate-600 hover:bg-slate-50 hover:text-ink"
              )}
            >
              <NavIcon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div ref={accountMenuRef} className="relative mt-auto border-t border-line pt-3">
        {accountMenuOpen ? (
          <div role="menu" aria-label="账号菜单" className="absolute inset-x-0 bottom-full mb-2 rounded-xl border border-line bg-white p-1 shadow-sm">
            <Link
              href="/account"
              role="menuitem"
              prefetch
              onClick={() => setAccountMenuOpen(false)}
              className={clsx(
                "flex rounded-lg px-2.5 py-2 text-sm font-medium transition",
                accountActive ? "bg-slate-100 text-ink" : "text-slate-600 hover:bg-slate-100 hover:text-ink"
              )}
            >
              设置
            </Link>
            <form action={logoutUser}>
              <button role="menuitem" className="flex w-full rounded-lg px-2.5 py-2 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-ink">
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
            "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition",
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
