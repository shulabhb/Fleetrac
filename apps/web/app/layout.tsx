import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { AppChrome } from "@/components/app-chrome";
import { AppMainShell } from "@/components/app-main-shell";
import { Sidebar } from "@/components/sidebar";

export const metadata: Metadata = {
  title: "Fleetrac · Governance Control Plane",
  description: "Observability-driven governance for production AI systems"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <AppChrome
          sidebar={
            <Suspense fallback={<aside className="h-full w-60 shrink-0 bg-[#0e2438]" />}>
              <Sidebar />
            </Suspense>
          }
        >
          <AppMainShell>{children}</AppMainShell>
        </AppChrome>
      </body>
    </html>
  );
}
