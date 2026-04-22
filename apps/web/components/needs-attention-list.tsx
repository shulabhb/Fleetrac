import Link from "next/link";
import { ArrowUpRight, AlertTriangle, Flag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { humanizeLabel } from "@/lib/present";
import { AnalyzeWithBob } from "@/components/bob/analyze-with-bob";

type Row = {
  incident: any;
};

function severityTone(sev: string): "high" | "medium" | "low" | "neutral" {
  if (sev === "high") return "high";
  if (sev === "medium") return "medium";
  if (sev === "low") return "low";
  return "neutral";
}

export function NeedsAttentionList({ rows }: { rows: Row[] }) {
  if (!rows.length) {
    return <p className="text-sm text-slate-500">Nothing urgent right now.</p>;
  }
  return (
    <ul className="divide-y divide-slate-100">
      {rows.map(({ incident }, idx) => {
        const escalated =
          incident.escalation_status === "escalated" || incident.incident_status === "escalated";
        return (
          <li key={incident.id} className="relative">
            <Link
              href={`/incidents/${incident.id}`}
              aria-label={`Open incident ${incident.title}`}
              className="absolute inset-0 z-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            />
            <div className="group pointer-events-none relative z-[1] grid grid-cols-[auto_1fr_auto] items-start gap-3 py-3">
              <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-600 ring-1 ring-slate-200">
                <span className="text-[11px] font-semibold tabular-nums">{idx + 1}</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
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
                      Review Required
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-700">{incident.title}</p>
                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                  <span className="truncate">
                    Next: <span className="text-slate-700">{incident.recommended_action}</span>
                  </span>
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Owner: {incident.owner_team}
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
