import { Badge } from "@/components/ui/badge";
import { fleetracAnalysisForIncident } from "@/lib/governance-demo-model-analysis";

type Props = {
  incidentId?: string;
  summary?: string;
  confidence?: "High" | "Medium" | "Low";
  recommendedAction?: string;
  compact?: boolean;
};

export function FleetracAnalysisPanel({
  incidentId,
  summary,
  confidence = "High",
  recommendedAction,
  compact = false
}: Props) {
  const text =
    summary ??
    (incidentId
      ? fleetracAnalysisForIncident(incidentId)
      : "Fleetrac analysis is bounded, policy-checked, and audit-linked.");

  return (
    <div
      className={
        compact
          ? "rounded-md border border-slate-100 bg-slate-50/60 px-3 py-2.5"
          : "rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"
      }
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Fleetrac Analysis
        </p>
        <Badge tone="info" size="xs">
          Confidence {confidence}
        </Badge>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-slate-800">{text}</p>
      {recommendedAction ? (
        <p className="mt-2 text-[12px] text-slate-600">
          <span className="font-medium text-slate-700">Recommended: </span>
          {recommendedAction}
        </p>
      ) : null}
      <p className="mt-2 text-[10px] leading-snug text-slate-400">
        Bounded analysis from live telemetry, agent traces, and governance policy signals — not
        unrestricted autonomous action.
      </p>
    </div>
  );
}
