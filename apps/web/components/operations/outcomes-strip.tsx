import Link from "next/link";
import { ArrowRight, LineChart } from "lucide-react";
import type { Change } from "@/lib/operations-types";
import { formatInteger } from "@/lib/format";

/**
 * Compact outcomes summary strip used on the Dashboard and as a handoff row
 * from Action Center to Outcomes. Intentionally minimal — it reports post-
 * execution state only, not approval queues.
 */
export function OutcomesStrip({
  changes,
  density = "full"
}: {
  changes: Change[];
  density?: "full" | "compact";
}) {
  const monitoring = changes.filter(
    (c) => c.impact_status === "monitoring" || c.impact_status === "executed"
  ).length;
  const improvement = changes.filter(
    (c) => c.impact_status === "improvement_observed"
  ).length;
  const followUp = changes.filter(
    (c) => c.impact_status === "follow_up_required" || c.follow_up_required
  ).length;
  const regression = changes.filter(
    (c) =>
      c.impact_status === "regression_detected" ||
      c.impact_status === "rollback_candidate" ||
      c.rollback_recommended
  ).length;
  const noChange = changes.filter(
    (c) => c.impact_status === "no_material_change"
  ).length;

  if (density === "compact") {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md border border-slate-200 bg-slate-50/60 px-3 py-2 text-[11px] text-slate-600">
        <span className="inline-flex items-center gap-1.5 text-slate-700">
          <LineChart className="h-3 w-3 text-slate-500" />
          <span className="font-medium">Outcomes</span>
        </span>
        <StatInline label="monitoring" value={monitoring} />
        <StatInline label="follow-up" value={followUp} tone={followUp > 0 ? "warn" : undefined} />
        <StatInline
          label="regression"
          value={regression}
          tone={regression > 0 ? "urgent" : undefined}
        />
        <Link
          href="/outcomes"
          className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 hover:text-slate-900"
        >
          View outcomes
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  return (
    <div className="relative flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3">
      <span
        aria-hidden
        className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r bg-gradient-to-b from-emerald-400 to-sky-200"
      />
      <div className="flex items-center gap-2 pl-2">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-slate-900/90 text-white">
          <LineChart className="h-3 w-3" />
        </span>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
            Outcomes · Post-remediation review
          </p>
          <p className="text-xs text-slate-600">
            Measured result of governed changes. What happened after execution.
          </p>
        </div>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-4 text-xs">
        <StripStat label="Under monitoring" value={monitoring} />
        <StripStat
          label="Improvement observed"
          value={improvement}
          tone="good"
          emphasize={improvement > 0}
        />
        <StripStat label="No material change" value={noChange} />
        <StripStat
          label="Follow-up required"
          value={followUp}
          tone="warn"
          emphasize={followUp > 0}
        />
        <StripStat
          label="Regression / rollback"
          value={regression}
          tone="urgent"
          emphasize={regression > 0}
        />
        <Link
          href="/outcomes"
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          Open Outcomes
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

function StatInline({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone?: "warn" | "urgent";
}) {
  const color =
    tone === "urgent"
      ? "text-rose-700"
      : tone === "warn"
        ? "text-amber-700"
        : "text-slate-900";
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className={`text-[12px] font-semibold tabular-nums ${color}`}>
        {formatInteger(value)}
      </span>
      <span className="text-slate-500">{label}</span>
    </span>
  );
}

function StripStat({
  label,
  value,
  emphasize,
  tone
}: {
  label: string;
  value: number;
  emphasize?: boolean;
  tone?: "good" | "warn" | "urgent";
}) {
  const color = emphasize
    ? tone === "urgent"
      ? "text-rose-700"
      : tone === "warn"
        ? "text-amber-700"
        : tone === "good"
          ? "text-emerald-700"
          : "text-slate-900"
    : "text-slate-900";
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`text-sm font-semibold tabular-nums ${color}`}>
        {formatInteger(value)}
      </span>
      <span className="text-[11px] text-slate-500">{label}</span>
    </div>
  );
}
