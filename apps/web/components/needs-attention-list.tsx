"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LiveRelativeTime } from "@/components/live-relative-time";
import { INCIDENT_DEMO_EVENT } from "@/lib/demo-state";
import { buildIncidentQueueListForTriageDock } from "@/lib/incident-queue-triage-list";
import { migrateLegacyIncidentStatus } from "@/lib/incident-lifecycle";
import { humanizeLabel } from "@/lib/present";
import { appendReturnTo, routeToIncident, routes } from "@/lib/routes";
import { cn } from "@/lib/cn";

function severityTone(sev: string): "high" | "medium" | "low" | "neutral" {
  if (sev === "high") return "high";
  if (sev === "medium") return "medium";
  if (sev === "low") return "low";
  return "neutral";
}

function lifecycleTag(incident: any): { label: string; tone: "info" | "medium" | "neutral" } {
  const s = migrateLegacyIncidentStatus(incident.incident_status);
  if (s === "pending") return { label: "In progress", tone: "medium" };
  if (s === "open") return { label: "New", tone: "info" };
  return { label: "Open", tone: "neutral" };
}

/** Canonical “new” — not yet in review / pending triage (matches Incident Queue default view). */
function isNewUnopened(incident: any): boolean {
  return migrateLegacyIncidentStatus(incident.incident_status) === "open";
}

/**
 * Dashboard operator command surface — same open-queue ordering and demo overlay
 * as {@link IncidentQueueTable} defaults; highlights new / not-yet-triaged incidents.
 */
export function NeedsAttentionList({ incidents }: { incidents: any[] }) {
  const [demoEpoch, setDemoEpoch] = useState(0);

  useEffect(() => {
    const bump = () => setDemoEpoch((n) => n + 1);
    window.addEventListener(INCIDENT_DEMO_EVENT, bump as EventListener);
    return () => window.removeEventListener(INCIDENT_DEMO_EVENT, bump as EventListener);
  }, []);

  const rows = useMemo(
    () => buildIncidentQueueListForTriageDock(incidents),
    [incidents, demoEpoch]
  );

  if (!rows.length) {
    return (
      <p className="px-3 py-4 text-sm text-slate-500">
        Queue is quiet. No open incidents (same default as Incident Queue).
      </p>
    );
  }

  const returnTo = routes.dashboard();

  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((incident, idx) => {
        const incidentHref = appendReturnTo(routeToIncident(incident.id), returnTo);
        const escalated = incident.escalation_status === "escalated";
        const primary = lifecycleTag(incident);
        const fresh = isNewUnopened(incident);
        const sevLabel =
          incident.severity === "high"
            ? "Sev H"
            : incident.severity === "medium"
              ? "Sev M"
              : incident.severity === "low"
                ? "Sev L"
                : "Sev";

        return (
          <li key={incident.id}>
            <Link
              href={incidentHref}
              className={cn(
                "group flex items-center gap-3 px-3 py-2.5 transition focus-visible:outline focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                fresh
                  ? "border-l-[3px] border-l-indigo-500 bg-indigo-50/60 hover:bg-indigo-50/90"
                  : "hover:bg-slate-50/90"
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded text-[10px] font-semibold tabular-nums text-white",
                  fresh ? "bg-indigo-700" : "bg-slate-900"
                )}
              >
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={primary.tone} size="xs" className="font-semibold">
                    {primary.label}
                  </Badge>
                  {incident.review_required ? (
                    <Badge tone="outline" size="xs" className="font-medium">
                      Review
                    </Badge>
                  ) : null}
                  {escalated ? (
                    <Badge tone="high" size="xs" className="font-medium">
                      Escalated
                    </Badge>
                  ) : null}
                  <Badge tone={severityTone(incident.severity)} size="xs" className="font-medium">
                    {sevLabel}
                  </Badge>
                  {incident.risk_category ? (
                    <Badge tone="outline" size="xs" className="max-w-[7rem] truncate font-medium">
                      {humanizeLabel(incident.risk_category)}
                    </Badge>
                  ) : null}
                </div>
                <p
                  className={cn(
                    "mt-1 truncate text-[12px] leading-snug text-slate-900",
                    fresh && "font-bold text-slate-950"
                  )}
                >
                  {incident.title}
                </p>
                <p className="truncate text-[11px] text-slate-500">
                  {incident.system_name}
                  <span className="text-slate-300"> · </span>
                  {incident.owner_team}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                  Reported
                </p>
                <LiveRelativeTime
                  value={incident.created_at}
                  className="text-[11px] font-medium text-slate-600"
                />
              </div>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-slate-500"
                aria-hidden
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
