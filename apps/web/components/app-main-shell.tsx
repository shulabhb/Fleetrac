"use client";

/**
 * Main pane: scrollable page content (incident triage dock removed — use Incident Queue).
 */
export function AppMainShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain">
        <div className="mx-auto max-w-[1400px] px-6 py-6 md:px-8 md:py-8">{children}</div>
      </div>
    </div>
  );
}
