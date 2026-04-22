import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { humanizeLabel } from "@/lib/present";

type AtRiskItem = {
  system: any;
  openCount: number;
  highestSeverity?: "high" | "medium" | "low" | null;
};

function postureTone(posture: string): "high" | "medium" | "low" | "neutral" {
  if (posture === "critical" || posture === "at_risk") return "high";
  if (posture === "watch") return "medium";
  if (posture === "healthy") return "low";
  return "neutral";
}

export function AtRiskList({ items }: { items: AtRiskItem[] }) {
  if (!items.length) {
    return <p className="text-sm text-slate-500">No systems currently flagged at risk.</p>;
  }
  return (
    <ul className="divide-y divide-slate-100">
      {items.map(({ system, openCount, highestSeverity }) => (
        <li key={system.id}>
          <Link
            href={`/systems/${system.id}`}
            className="group flex items-center justify-between gap-3 py-2.5 pr-1 transition hover:text-slate-900"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium text-slate-900">
                  {system.use_case} ({system.model})
                </p>
                <Badge tone={postureTone(system.risk_posture)} size="xs" dot>
                  {humanizeLabel(system.risk_posture)}
                </Badge>
              </div>
              <p className="mt-0.5 truncate text-[11px] text-slate-500">
                {system.id} · {system.owner}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3 text-xs text-slate-600">
              <div className="flex items-center gap-1.5">
                <span className="tabular-nums font-semibold text-slate-900">{openCount}</span>
                <span className="text-slate-500">open</span>
              </div>
              {highestSeverity ? (
                <Badge tone={highestSeverity === "high" ? "high" : highestSeverity === "medium" ? "medium" : "low"} size="xs">
                  {humanizeLabel(highestSeverity)}
                </Badge>
              ) : null}
              <ChevronRight className="h-3.5 w-3.5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-700" />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
