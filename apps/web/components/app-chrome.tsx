"use client";

import { useEffect, type ReactNode } from "react";

/**
 * App-wide shell: viewport-height row with a scrollable sidebar column and a
 * main column whose children own vertical scroll (see {@link AppMainShell}).
 */
export function AppChrome({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] w-full min-h-0 overflow-hidden overscroll-none">
      <div className="h-full min-h-0 w-60 shrink-0 overflow-x-hidden">
        {sidebar}
      </div>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
