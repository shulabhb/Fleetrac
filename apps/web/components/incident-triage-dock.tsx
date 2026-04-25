"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { IncidentTriageRail, INCIDENT_TRIAGE_DOCK_CAPTION } from "@/components/incident-triage-rail";
import { INCIDENT_DEMO_EVENT } from "@/lib/demo-state";
import { buildIncidentQueueListForTriageDock } from "@/lib/incident-queue-triage-list";
import { routes, safeReturnTo } from "@/lib/routes";

export function IncidentTriageDock({ activeIncidentId }: { activeIncidentId: string }) {
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get("returnTo"), routes.incidents());
  const [items, setItems] = useState<any[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [demoEpoch, setDemoEpoch] = useState(0);

  useEffect(() => {
    const bump = () => setDemoEpoch((n) => n + 1);
    window.addEventListener(INCIDENT_DEMO_EVENT, bump as EventListener);
    return () => window.removeEventListener(INCIDENT_DEMO_EVENT, bump as EventListener);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/incidents", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled && res.ok && Array.isArray(data.items)) {
          setItems(data.items);
          setFailed(false);
        } else if (!cancelled) {
          setFailed(true);
          setItems([]);
        }
      } catch {
        if (!cancelled) {
          setFailed(true);
          setItems([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeIncidentId]);

  const rows = useMemo(() => {
    if (!items?.length) return [];
    return buildIncidentQueueListForTriageDock(items);
  }, [items, demoEpoch]);

  if (items === null) {
    return (
      <div className="flex min-h-0 flex-1 flex-col p-3">
        <p className="text-[10px] leading-snug text-slate-500">{INCIDENT_TRIAGE_DOCK_CAPTION}</p>
        <p className="mt-2 text-[11px] text-slate-500">Loading queue…</p>
      </div>
    );
  }

  if (failed && rows.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col p-3">
        <p className="text-[10px] leading-snug text-slate-500">{INCIDENT_TRIAGE_DOCK_CAPTION}</p>
        <p className="mt-2 text-[11px] text-slate-600">Queue unavailable. Use Incident Queue.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <IncidentTriageRail
        activeIncidentId={activeIncidentId}
        incidents={rows}
        returnTo={returnTo}
        variant="dock"
        showAllIncidentsLink
      />
    </div>
  );
}
