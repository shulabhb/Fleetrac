import Link from "next/link";
import { ArrowUpRight, Flag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { humanizeLabel } from "@/lib/present";
import { AnalyzeWithBob } from "@/components/bob/analyze-with-bob";
import { appendReturnTo, routeToIncident, routes } from "@/lib/routes";

type Row = {
  incident: any;
};

function severityTone(sev: string): "high" | "medium" | "low" | "neutral" {
  if (sev === "high") return "high";
  if (sev === "medium") return "medium";
  if (sev === "low") return "low";
  return "neutral";
}

/**
 * Ranked triage queue for the Dashboard. Each row conveys, in one glance:
 * priority rank · system · severity · escalation/review state · next action ·
 * owner · optional Bob link.
 *
 * Kept intentionally compact — this is the single most operationally
 * actionable module on the Dashboard and should read like a work list.
 */
export function NeedsAttentionList({ rows }: { rows: Row[] }) {
  if (!rows.length) {
    return (
      <p className="text-sm text-slate-500">
        Queue is quiet. No incidents require immediate action.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-slate-100">
      {rows.map(({ incident }, idx) => {
        const escalated =
          incident.escalation_status === "escalated" ||
          incident.incident_status === "escalated";
        return (
          <li key={incident.id} className="relative">
            <Link
              href={appendReturnTo(routeToIncident(incident.id), routes.dashboard())}
              aria-label={`Open incident ${incident.title}`}
              className="absolute inset-0 z-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            />
            <div className="group pointer-events-none relative z-[1] grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 py-2.5">
              <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white">
                <span className="text-[11px] font-semibold tabular-nums">
                  {idx + 1}
                </span>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {incident.system_name}
                  </p>
                  <Badge tone={severityTone(incident.severity)} size="xs">
                    {humanizeLabel(incident.severity)}
                  </Badge>
                  {escalated ? (
                    <Badge tone="high" size="xs">
                      <Flag className="h-3 w-3" /> Escalated
                    </Badge>
                  ) : incident.review_required ? (
                    <Badge tone="medium" size="xs">
                      Review required
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-700">
                  {incident.title}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                  <span className="truncate">
                    <span className="text-slate-400">Next</span>{" "}
                    <span className="text-slate-700">
                      {incident.recommended_action}
                    </span>
                  </span>
                  <span className="truncate">
                    <span className="text-slate-400">Owner</span>{" "}
                    <span className="text-slate-700">
                      {incident.owner_team}
                    </span>
                  </span>
                </p>
                <div className="pointer-events-auto mt-1.5">
                  <AnalyzeWithBob
                    targetType="incident"
                    targetId={incident.id}
                    hasInvestigation
                    label="View Bob analysis"
                  />
                </div>
              </div>

              <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-slate-700" />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
