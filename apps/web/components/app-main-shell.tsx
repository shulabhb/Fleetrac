"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { IncidentTriageDock } from "@/components/incident-triage-dock";
import { INCIDENT_TRIAGE_DOCK_CAPTION } from "@/components/incident-triage-rail";

function TriageDockFallback() {
  return (
    <div className="flex min-h-0 flex-1 flex-col p-3">
      <p className="text-[10px] leading-snug text-slate-500">{INCIDENT_TRIAGE_DOCK_CAPTION}</p>
      <p className="mt-2 text-[11px] text-slate-500">Loading…</p>
    </div>
  );
}

/**
 * Main pane: optional incident triage column + scrollable page content.
 */
export function AppMainShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const match = pathname.match(/^\/incidents\/([^/]+)\/?$/);
  const triageIncidentId = match?.[1] ?? null;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
      {triageIncidentId ? (
        <aside className="hidden h-full min-h-0 w-56 shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white md:flex md:flex-col lg:w-60">
          <Suspense fallback={<TriageDockFallback />}>
            <IncidentTriageDock activeIncidentId={triageIncidentId} />
          </Suspense>
        </aside>
      ) : null}
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain">
        <div className="mx-auto max-w-[1400px] px-6 py-6 md:px-8 md:py-8">{children}</div>
      </div>
    </div>
  );
}
