"use client";

import clsx from "clsx";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";

type AppFrameProps = {
  children: React.ReactNode;
  currentUser: {
    name: string | null;
    email: string;
  } | null;
};

const authPaths = new Set(["/login", "/register"]);

export function AppFrame({ children, currentUser }: AppFrameProps) {
  const pathname = usePathname();
  const isAuthPage = authPaths.has(pathname);

  return (
    <div
      className={clsx(
        "mx-auto min-h-screen max-w-[1600px] px-4 py-4 md:px-6 lg:px-8",
        isAuthPage ? "flex items-center justify-center" : "flex gap-5"
      )}
    >
      {!isAuthPage ? <Sidebar currentUser={currentUser} /> : null}
      <main className={clsx("min-w-0", isAuthPage ? "w-full max-w-md" : "flex-1")}>{children}</main>
    </div>
  );
}
