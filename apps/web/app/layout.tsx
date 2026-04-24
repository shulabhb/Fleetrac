import type { Metadata } from "next";
import "./globals.css";
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
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="min-w-0 flex-1">
            <div className="mx-auto max-w-[1400px] px-6 py-6 md:px-8 md:py-8">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
