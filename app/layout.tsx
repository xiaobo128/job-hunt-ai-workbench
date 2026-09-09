import "./globals.css";
import type { Metadata } from "next";
import { AppFrame } from "@/components/app-frame";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "AI Job Hunt Workbench",
  description: "An AI-powered job search workspace for tracking jobs, resumes, notifications, and automation."
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AppFrame
          currentUser={
            user
              ? {
                  name: user.name,
                  email: user.email
                }
              : null
          }
        >
          {children}
        </AppFrame>
      </body>
    </html>
  );
}
