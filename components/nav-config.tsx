import type { ReactNode } from "react";

export const navItems = [
  { href: "/", label: "首页", icon: "home" },
  { href: "/jobs", label: "我的求职", icon: "briefcase" },
  { href: "/resumes", label: "我的简历", icon: "fileText" },
  { href: "/notifications", label: "通知管理", icon: "bell" },
  { href: "/recruitment-event-agent", label: "招聘 Agent", icon: "sparkles" },
  { href: "/proposals", label: "写入确认", icon: "shieldCheck" }
] as const;

export type IconName = (typeof navItems)[number]["icon"];

export function NavIcon({ name }: { name: IconName }) {
  const paths = {
    home: <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z" />,
    briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" /></>,
    fileText: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></>,
    bell: <><path d="M18 9a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    sparkles: <><path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z" /><path d="m19 14 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z" /><path d="m5 15 .6 1.4L7 17l-1.4.6L5 19l-.6-1.4L3 17l1.4-.6L5 15Z" /></>,
    shieldCheck: <><path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Z" /><path d="m8.5 12 2.2 2.2 4.8-4.8" /></>
  } satisfies Record<IconName, ReactNode>;

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5 shrink-0">
      {paths[name]}
    </svg>
  );
}

export function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}
