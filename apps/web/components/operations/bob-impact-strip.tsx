import Link from "next/link";
import { ArrowRight, Activity } from "lucide-react";
import type { BobImpactSummary } from "@/lib/operations-types";
import { formatInteger } from "@/lib/format";

/**
 * Dashboard strip that closes the loop from recommendation to outcome.
 * Answers the executive question: "Is Bob actually making the fleet better?"
 */
export function BobImpactStrip({ summary }: { summary: BobImpactSummary }) {
  return (
    <div className="relative flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3">
      <span
        aria-hidden
        className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r bg-gradient-to-b from-emerald-400 to-sky-200"
      />
      <div className="flex items-center gap-2 pl-2">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-slate-900/90 text-white">
          <Activity className="h-3 w-3" />
        </span>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
            Bob Impact · {summary.window_label}
          </p>
          <p className="text-xs text-slate-600">
            Expected vs measured impact of Bob-prepared changes across the fleet.
          </p>
        </div>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-4 text-xs">
        <Stat label="Actions executed" value={summary.actions_executed} />
        <Stat
          label="Improvements"
          value={summary.improvements_observed}
          tone="good"
          emphasize={summary.improvements_observed > 0}
        />
        <Stat label="No material change" value={summary.no_material_change} />
        <Stat
          label="Regressions"
          value={summary.regressions_detected}
          tone="urgent"
          emphasize={summary.regressions_detected > 0}
        />
        <Stat
          label="Rollback candidates"
          value={summary.rollback_candidates}
          tone="urgent"
          emphasize={summary.rollback_candidates > 0}
        />
        <Stat label="Recurrence reduced" value={summary.recurrence_reduced} />
        <Stat
          label="Reviewer burden reduced"
          value={summary.reviewer_burden_reduced}
        />
        <Link
          href="/outcomes"
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          View outcomes
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  emphasize
}: {
  label: string;
  value: number;
  tone?: "good" | "urgent";
  emphasize?: boolean;
}) {
  const color = emphasize
    ? tone === "urgent"
      ? "text-rose-700"
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
