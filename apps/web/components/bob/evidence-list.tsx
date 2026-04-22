import {
  Activity,
  Database,
  FileClock,
  Gauge,
  Layers,
  LineChart,
  ShieldCheck,
  Timer,
  TrendingUp
} from "lucide-react";
import type { BobEvidence, EvidenceType } from "@/lib/bob-types";
import { cn } from "@/lib/cn";

const ICONS: Record<EvidenceType, typeof Activity> = {
  telemetry_snapshot: Gauge,
  similar_incidents: Layers,
  active_controls: ShieldCheck,
  audit_coverage: FileClock,
  threshold_history: Timer,
  governance_activity: Activity,
  recurrence_pattern: TrendingUp,
  drift_trend: LineChart,
  control_fire_rate: Database
};

export function EvidenceList({
  evidence,
  className
}: {
  evidence: BobEvidence[];
  className?: string;
}) {
  if (!evidence.length) {
    return (
      <p className={cn("text-xs text-slate-500", className)}>
        Bob has not recorded evidence for this investigation yet.
      </p>
    );
  }
  return (
    <ul className={cn("space-y-2.5", className)}>
      {evidence.map((item) => {
        const Icon = ICONS[item.type] ?? Activity;
        return (
          <li
            key={item.id}
            className="flex gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5"
          >
            <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-50 text-slate-500 ring-1 ring-slate-200">
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-semibold text-slate-900">{item.label}</p>
                {item.value ? (
                  <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 tabular-nums">
                    {item.value}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs leading-snug text-slate-600">{item.detail}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
