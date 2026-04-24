import Link from "next/link";
import { ArrowRight, TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { Change, MetricDelta } from "@/lib/operations-types";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VersionChip } from "./operations-badges";
import { routeToAction } from "@/lib/routes";

function formatMetricValue(value: number | null | undefined, unit?: string | null) {
  if (value == null) return "—";
  const digits = Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2;
  const base = Number(value).toFixed(digits);
  return unit ? `${base}${unit.startsWith("/") ? unit : unit}` : base;
}

function deltaDirection(delta: MetricDelta): "improved" | "worse" | "flat" {
  if (delta.before == null || delta.after == null) return "flat";
  const diff = delta.after - delta.before;
  const threshold = Math.abs(delta.before) * 0.02;
  if (Math.abs(diff) < threshold) return "flat";
  if (delta.direction === "lower_is_better") {
    return diff < 0 ? "improved" : "worse";
  }
  return diff > 0 ? "improved" : "worse";
}

export function MetricDeltaRow({ delta }: { delta: MetricDelta }) {
  const dir = deltaDirection(delta);
  const pct =
    delta.before != null && delta.after != null && delta.before !== 0
      ? ((delta.after - delta.before) / delta.before) * 100
      : null;
  const Icon = dir === "improved" ? TrendingDown : dir === "worse" ? TrendingUp : Minus;
  const iconColor =
    dir === "improved"
      ? "text-emerald-600"
      : dir === "worse"
        ? "text-rose-600"
        : "text-slate-400";
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 py-1 text-[12px]">
      <div className="min-w-0">
        <div className="truncate font-medium text-slate-800">{delta.label}</div>
        <div className="truncate text-[11px] text-slate-500">
          {delta.baseline_window} → {delta.monitoring_window}
        </div>
      </div>
      <div className="flex items-center gap-2 tabular-nums">
        <span className="text-slate-500">
          {formatMetricValue(delta.before, delta.unit)}
        </span>
        <ArrowRight className="h-3 w-3 text-slate-400" />
        <span className="font-semibold text-slate-900">
          {formatMetricValue(delta.after, delta.unit)}
        </span>
        {pct != null ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 text-[10px] font-medium",
              dir === "improved" && "bg-emerald-50 text-emerald-700",
              dir === "worse" && "bg-rose-50 text-rose-700",
              dir === "flat" && "bg-slate-100 text-slate-600"
            )}
          >
            <Icon className={cn("h-3 w-3", iconColor)} />
            {pct > 0 ? "+" : ""}
            {pct.toFixed(1)}%
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function ChangeImpactCard({ change }: { change: Change }) {
  return (
    <Card density="compact" surface="evidence" className="space-y-3">
      <CardHeader
        title={change.change_type}
        caption={
          <span className="text-slate-500">
            {change.impact_status.replace(/_/g, " ")} · {change.environment} ·{" "}
            {change.changed_by_label} · executed{" "}
            {formatRelativeTime(change.executed_at)}
          </span>
        }
        action={
          change.source_action_id ? (
            <Link
              href={routeToAction(change.source_action_id)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
            >
              Action
              <ArrowRight className="h-3 w-3" />
            </Link>
          ) : null
        }
      />
      <p className="text-[12px] text-slate-700">{change.change_summary}</p>
      {(change.version_before || change.version_after) && (
        <div className="flex flex-wrap items-center gap-2">
          {change.version_before && (
            <VersionChip version={change.version_before} label="prev" />
          )}
          <ArrowRight className="h-3 w-3 text-slate-400" />
          {change.version_after && (
            <VersionChip
              version={change.version_after}
              label="now"
              tone="info"
            />
          )}
        </div>
      )}
      <div className="grid gap-3 rounded-md bg-slate-50 p-3 md:grid-cols-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Bob expected
          </p>
          <p className="mt-1 text-[12px] text-slate-700">
            {change.expected_impact_summary}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            What actually happened
          </p>
          <p className="mt-1 text-[12px] text-slate-700">
            {change.actual_outcome_summary}
          </p>
        </div>
      </div>
      {change.metric_deltas.length > 0 && (
        <div className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white px-3">
          {change.metric_deltas.map((delta) => (
            <MetricDeltaRow key={delta.metric} delta={delta} />
          ))}
        </div>
      )}
      <div className="grid gap-2 text-[11px] text-slate-600 md:grid-cols-3">
        <ChangeStat
          label="Recurrence"
          before={change.recurrence_before}
          after={change.recurrence_after}
          unit="/wk"
        />
        <ChangeStat
          label="Reviewer burden"
          before={change.reviewer_burden_before}
          after={change.reviewer_burden_after}
          unit="h"
        />
        <div className="flex flex-wrap items-center gap-1">
          {change.rollback_recommended && (
            <Badge tone="high">Rollback recommended</Badge>
          )}
          {change.follow_up_required && <Badge tone="medium">Follow-up required</Badge>}
          {!change.rollback_recommended && !change.follow_up_required && (
            <Badge tone="outline">No open follow-ups</Badge>
          )}
        </div>
      </div>
    </Card>
  );
}

function ChangeStat({
  label,
  before,
  after,
  unit
}: {
  label: string;
  before?: number | null;
  after?: number | null;
  unit?: string;
}) {
  if (before == null || after == null) {
    return (
      <div>
        <span className="text-[10px] uppercase tracking-wide text-slate-500">
          {label}
        </span>
        <span className="ml-1.5 text-slate-400">—</span>
      </div>
    );
  }
  const delta = after - before;
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <span className="tabular-nums text-slate-700">
        {before}
        {unit}
      </span>
      <ArrowRight className="h-3 w-3 text-slate-400" />
      <span
        className={cn(
          "tabular-nums font-semibold",
          delta < 0
            ? "text-emerald-700"
            : delta > 0
              ? "text-rose-700"
              : "text-slate-700"
        )}
      >
        {after}
        {unit}
      </span>
    </div>
  );
}

export function ChangesTimeline({
  changes,
  emptyLabel = "No changes recorded in this window."
}: {
  changes: Change[];
  emptyLabel?: string;
}) {
  if (!changes.length) {
    return (
      <Card density="compact" className="text-[12px] text-slate-500">
        {emptyLabel}
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {changes.map((c) => (
        <ChangeImpactCard key={c.id} change={c} />
      ))}
    </div>
  );
}

/**
 * Compact mini-row used inside action or incident detail pages where a full
 * ChangeImpactCard would be too heavy.
 */
export function ChangeImpactMiniRow({ change }: { change: Change }) {
  const primary = change.metric_deltas[0];
  const pct =
    primary && primary.before != null && primary.after != null && primary.before !== 0
      ? ((primary.after - primary.before) / primary.before) * 100
      : null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-[12px]">
      <span className="font-medium text-slate-700">{change.change_type}</span>
      <span className="text-[11px] text-slate-500">
        {change.impact_status.replace(/_/g, " ")}
      </span>
      {primary && (
        <span className="text-slate-500">
          {primary.label}{" "}
          {pct != null ? (
            <span
              className={cn(
                "font-medium",
                pct < 0 ? "text-emerald-700" : pct > 0 ? "text-rose-700" : "text-slate-600"
              )}
            >
              {pct > 0 ? "+" : ""}
              {pct.toFixed(1)}%
            </span>
          ) : null}
        </span>
      )}
      <span className="ml-auto text-slate-500">
        {formatRelativeTime(change.executed_at)}
      </span>
    </div>
  );
}
