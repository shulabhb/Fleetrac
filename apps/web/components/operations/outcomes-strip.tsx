import Link from "next/link";
import { ArrowRight, LineChart } from "lucide-react";
import type { BobImpactSummary, Change } from "@/lib/operations-types";
import { formatInteger } from "@/lib/format";
import {
  DashboardStrip,
  StripDivider,
  StripStat
} from "@/components/dashboard/strip";
import { routes, routeToOutcomesTab } from "@/lib/routes";

/**
 * Compact outcomes summary strip used on the Dashboard and as a handoff row
 * from Action Center to Outcomes. Intentionally minimal — it reports post-
 * execution state only, not approval queues.
 *
 * Optionally accepts a `bobImpact` summary and renders its distinctive delta
 * metrics (recurrence reduced, reviewer burden reduced, control fires
 * reduced) as a secondary stat group, avoiding a redundant second strip on
 * the Dashboard.
 */
export function OutcomesStrip({
  changes,
  density = "full",
  bobImpact
}: {
  changes: Change[];
  density?: "full" | "compact";
  bobImpact?: BobImpactSummary | null;
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
          <span className="font-medium">Measurement handoff</span>
        </span>
        <StatInline label="monitoring" value={monitoring} />
        <StatInline
          label="follow-up"
          value={followUp}
          tone={followUp > 0 ? "warn" : undefined}
        />
        <StatInline
          label="regression"
          value={regression}
          tone={regression > 0 ? "urgent" : undefined}
        />
        <Link
          href={routes.outcomes()}
          className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 hover:text-slate-900"
        >
          Measure outcomes
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  return (
    <DashboardStrip
      accent="emerald"
      icon={<LineChart className="h-3.5 w-3.5" />}
      eyebrow={
        <>
          Measure · Post-remediation review
        </>
      }
      caption="Verify executed changes, close evidence, or route rollback follow-up."
      cta={{ label: "Measure outcomes", href: routes.outcomes() }}
      stats={
        <>
          <StripStat
            label="Under monitoring"
            value={monitoring}
            href={routeToOutcomesTab("monitoring")}
          />
          <StripStat
            label="Improvement observed"
            value={improvement}
            tone="good"
            emphasize={improvement > 0}
            href={routeToOutcomesTab("improvement")}
          />
          <StripStat
            label="No material change"
            value={noChange}
            href={routeToOutcomesTab("closed")}
          />
          <StripStat
            label="Follow-up required"
            value={followUp}
            tone="warn"
            emphasize={followUp > 0}
            href={routeToOutcomesTab("follow_up")}
          />
          <StripStat
            label="Rollback candidates"
            value={regression}
            tone="urgent"
            emphasize={regression > 0}
            href={routeToOutcomesTab("regression")}
          />
          {bobImpact ? (
            <>
              <StripDivider />
              <StripStat
                label={`Recurrence reduced · ${bobImpact.window_label}`}
                value={bobImpact.recurrence_reduced}
                tone="good"
                emphasize={bobImpact.recurrence_reduced > 0}
              />
              <StripStat
                label="Reviewer burden reduced"
                value={bobImpact.reviewer_burden_reduced}
                tone="good"
                emphasize={bobImpact.reviewer_burden_reduced > 0}
              />
            </>
          ) : null}
        </>
      }
    />
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
