import type { Metadata } from "next";
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
        <AppChrome sidebar={<Sidebar />}>
          <AppMainShell>{children}</AppMainShell>
        </AppChrome>
      </body>
    </html>
  );
}
