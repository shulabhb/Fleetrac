"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Search, TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { Change, ChangeLifecycleState, MetricDelta } from "@/lib/operations-types";
import { KpiCard } from "@/components/kpi-card";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChangeStateBadge, EnvironmentChip } from "./operations-badges";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";

type Segment =
  | "all"
  | "monitoring"
  | "improvement"
  | "follow_up"
  | "regression"
  | "closed";

const SEGMENTS: { id: Segment; label: string; caption: string }[] = [
  {
    id: "monitoring",
    label: "Under monitoring",
    caption:
      "Monitoring window open. Outcome not yet stable — Bob is still measuring against the baseline."
  },
  {
    id: "improvement",
    label: "Improvement observed",
    caption:
      "Monitored metrics moved in the expected direction beyond the noise threshold."
  },
  {
    id: "follow_up",
    label: "Follow-up required",
    caption:
      "Partial or ambiguous outcome. Reviewer sign-off, additional action, or extended monitoring is needed."
  },
  {
    id: "regression",
    label: "Regression / rollback",
    caption:
      "Metrics worsened or Bob has flagged this as a rollback candidate. Serious review required."
  },
  {
    id: "closed",
    label: "Closed",
    caption: "Outcome finalized. Kept for audit and trend learning."
  },
  {
    id: "all",
    label: "All",
    caption: "Full outcome portfolio across the fleet in the current window."
  }
];

function inSegment(c: Change, seg: Segment): boolean {
  switch (seg) {
    case "all":
      return true;
    case "monitoring":
      return c.impact_status === "monitoring" || c.impact_status === "executed";
    case "improvement":
      return c.impact_status === "improvement_observed";
    case "follow_up":
      return (
        c.impact_status === "follow_up_required" ||
        (c.follow_up_required && c.impact_status !== "regression_detected" &&
          c.impact_status !== "rollback_candidate")
      );
    case "regression":
      return (
        c.impact_status === "regression_detected" ||
        c.impact_status === "rollback_candidate" ||
        c.rollback_recommended
      );
    case "closed":
      return c.impact_status === "closed" || c.impact_status === "no_material_change";
  }
}

export function OutcomesView({
  changes,
  systemFilter
}: {
  changes: Change[];
  systemFilter?: string | null;
}) {
  const scoped = useMemo(
    () =>
      systemFilter ? changes.filter((c) => c.target_system_id === systemFilter) : changes,
    [changes, systemFilter]
  );

  const [segment, setSegment] = useState<Segment>("monitoring");
  const [query, setQuery] = useState("");
  const [env, setEnv] = useState<string>("all");
  const [changeType, setChangeType] = useState<string>("all");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    const t = q.get("tab") as Segment | null;
    if (t && SEGMENTS.some((s) => s.id === t)) setSegment(t);
  }, []);

  const counts = useMemo(() => {
    const base: Record<Segment, number> = {
      all: scoped.length,
      monitoring: 0,
      improvement: 0,
      follow_up: 0,
      regression: 0,
      closed: 0
    };
    for (const c of scoped) {
      for (const s of SEGMENTS) {
        if (s.id === "all") continue;
        if (inSegment(c, s.id)) base[s.id] += 1;
      }
    }
    return base;
  }, [scoped]);

  const kpis = useMemo(() => {
    const rollback = scoped.filter(
      (c) => c.rollback_recommended || c.impact_status === "rollback_candidate"
    ).length;
    return {
      monitoring: counts.monitoring,
      improvement: counts.improvement,
      followUp: counts.follow_up,
      regression: counts.regression,
      rollback
    };
  }, [scoped, counts]);

  const changeTypes = useMemo(() => {
    const set = new Set<string>();
    scoped.forEach((c) => set.add(c.change_type));
    return Array.from(set).sort();
  }, [scoped]);

  const envs = useMemo(() => {
    const set = new Set<string>();
    scoped.forEach((c) => set.add(c.environment));
    return Array.from(set).sort();
  }, [scoped]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped.filter((c) => {
      if (!inSegment(c, segment)) return false;
      if (env !== "all" && c.environment !== env) return false;
      if (changeType !== "all" && c.change_type !== changeType) return false;
      if (q) {
        const hay = `${c.change_type} ${c.change_summary} ${c.target_system_name} ${c.expected_impact_summary} ${c.actual_outcome_summary}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [scoped, segment, env, changeType, query]);

  const seg = SEGMENTS.find((s) => s.id === segment)!;

  return (
    <section className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Under monitoring"
          value={kpis.monitoring}
          caption="Monitoring window still open"
        />
        <KpiCard
          label="Improvement observed"
          value={kpis.improvement}
          caption="Metrics moved as Bob expected"
          tone={kpis.improvement > 0 ? "ok" : "neutral"}
        />
        <KpiCard
          label="No material change"
          value={counts.closed}
          caption="Closed or no material movement"
        />
        <KpiCard
          label="Follow-up required"
          value={kpis.followUp}
          caption="Partial or ambiguous outcome"
          tone={kpis.followUp > 0 ? "warning" : "neutral"}
          highlight={kpis.followUp > 0}
        />
        <KpiCard
          label="Regression / rollback"
          value={kpis.regression}
          caption="Worsened or rollback candidate"
          tone={kpis.regression > 0 ? "urgent" : "neutral"}
          highlight={kpis.regression > 0}
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap gap-0 border-b border-slate-200 px-1.5 pt-1.5">
          {SEGMENTS.map((s) => {
            const active = s.id === segment;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSegment(s.id)}
                className={
                  "relative rounded-md px-3 py-1.5 text-xs font-medium transition " +
                  (active
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")
                }
              >
                {s.label}
                <span
                  className={
                    "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums " +
                    (active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600")
                  }
                >
                  {counts[s.id]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2.5">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search changes, systems, outcomes…"
              className="h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
            />
          </div>
          <Select value={env} onChange={(e) => setEnv(e.target.value)}>
            <option value="all">Any environment</option>
            {envs.map((e) => (
              <option key={e} value={e}>
                {e.replace("_", " ")}
              </option>
            ))}
          </Select>
          <Select
            value={changeType}
            onChange={(e) => setChangeType(e.target.value)}
          >
            <option value="all">Any change type</option>
            {changeTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>

        <div className="px-3 py-2 text-[11px] text-slate-500">{seg.caption}</div>
      </div>

      <div className="space-y-2.5">
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            No outcomes in this view.
          </div>
        ) : (
          filtered.map((c) => <OutcomeRow key={c.id} change={c} />)
        )}
      </div>
    </section>
  );
}

function primaryDelta(change: Change): MetricDelta | null {
  return change.metric_deltas[0] ?? null;
}

function deltaPct(delta: MetricDelta): number | null {
  if (delta.before == null || delta.after == null || delta.before === 0) return null;
  return ((delta.after - delta.before) / delta.before) * 100;
}

function deltaDirection(delta: MetricDelta): "improved" | "worse" | "flat" {
  if (delta.before == null || delta.after == null) return "flat";
  const diff = delta.after - delta.before;
  const threshold = Math.abs(delta.before) * 0.02;
  if (Math.abs(diff) < threshold) return "flat";
  if (delta.direction === "lower_is_better") return diff < 0 ? "improved" : "worse";
  return diff > 0 ? "improved" : "worse";
}

function nextStep(c: Change): { label: string; tone: "urgent" | "warn" | "ok" | "neutral" } {
  if (c.rollback_recommended || c.impact_status === "rollback_candidate")
    return { label: "Prepare rollback request", tone: "urgent" };
  if (c.impact_status === "regression_detected")
    return { label: "Review regression", tone: "urgent" };
  if (c.follow_up_required || c.impact_status === "follow_up_required")
    return { label: "Open follow-up monitoring", tone: "warn" };
  if (c.impact_status === "improvement_observed")
    return { label: "Close outcome", tone: "ok" };
  if (c.impact_status === "no_material_change" || c.impact_status === "closed")
    return { label: "None — closed", tone: "neutral" };
  return { label: "Monitor to next window", tone: "neutral" };
}

export function OutcomeRow({ change }: { change: Change }) {
  const d = primaryDelta(change);
  const pct = d ? deltaPct(d) : null;
  const dir = d ? deltaDirection(d) : "flat";
  const DeltaIcon = dir === "improved" ? TrendingDown : dir === "worse" ? TrendingUp : Minus;
  const deltaTone =
    dir === "improved"
      ? "text-emerald-700"
      : dir === "worse"
        ? "text-rose-700"
        : "text-slate-500";
  const step = nextStep(change);
  const stepTone: Record<string, string> = {
    urgent: "text-rose-700",
    warn: "text-amber-700",
    ok: "text-emerald-700",
    neutral: "text-slate-600"
  };

  return (
    <Card density="compact" className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <ChangeStateBadge state={change.impact_status} />
        <EnvironmentChip env={change.environment} />
        <span className="text-[13px] font-medium text-slate-900">
          {change.change_type}
        </span>
        <Link
          href={`/systems/${change.target_system_id}`}
          className="text-[12px] text-slate-500 hover:text-slate-900 hover:underline"
        >
          {change.target_system_name}
        </Link>
        <span className="ml-auto text-[11px] text-slate-500">
          Executed {formatRelativeTime(change.executed_at)} ·{" "}
          {change.changed_by_label}
        </span>
      </div>

      <p className="text-[12px] leading-relaxed text-slate-700">
        {change.change_summary}
      </p>

      <div className="grid gap-3 rounded-md bg-slate-50 p-2.5 md:grid-cols-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Expected
          </p>
          <p className="mt-0.5 text-[12px] text-slate-700">
            {change.expected_impact_summary}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Actual
          </p>
          <p className="mt-0.5 text-[12px] text-slate-700">
            {change.actual_outcome_summary}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-slate-100 pt-2 text-[11px] text-slate-600">
        {d ? (
          <span className="inline-flex items-center gap-1">
            <span className="text-slate-500">{d.label}</span>
            {pct != null ? (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-md bg-white px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-slate-200 tabular-nums",
                  deltaTone
                )}
              >
                <DeltaIcon className="h-3 w-3" />
                {pct > 0 ? "+" : ""}
                {pct.toFixed(1)}%
              </span>
            ) : null}
          </span>
        ) : null}

        {change.recurrence_before != null && change.recurrence_after != null ? (
          <span>
            <span className="text-slate-500">Recurrence</span>{" "}
            <span className="tabular-nums text-slate-700">
              {change.recurrence_before}/wk
            </span>
            <ArrowRight className="inline h-3 w-3 text-slate-400" />
            <span
              className={cn(
                "tabular-nums font-semibold",
                change.recurrence_after < change.recurrence_before
                  ? "text-emerald-700"
                  : change.recurrence_after > change.recurrence_before
                    ? "text-rose-700"
                    : "text-slate-700"
              )}
            >
              {change.recurrence_after}/wk
            </span>
          </span>
        ) : null}

        {change.reviewer_burden_before != null &&
        change.reviewer_burden_after != null ? (
          <span>
            <span className="text-slate-500">Reviewer burden</span>{" "}
            <span className="tabular-nums text-slate-700">
              {change.reviewer_burden_before}h
            </span>
            <ArrowRight className="inline h-3 w-3 text-slate-400" />
            <span
              className={cn(
                "tabular-nums font-semibold",
                change.reviewer_burden_after < change.reviewer_burden_before
                  ? "text-emerald-700"
                  : change.reviewer_burden_after > change.reviewer_burden_before
                    ? "text-rose-700"
                    : "text-slate-700"
              )}
            >
              {change.reviewer_burden_after}h
            </span>
          </span>
        ) : null}

        <span className="ml-auto inline-flex items-center gap-2">
          <span className={cn("font-medium", stepTone[step.tone])}>
            Next: {step.label}
          </span>
          <Link
            href={`/outcomes/${change.id}`}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:border-slate-300"
          >
            Open
            <ArrowRight className="h-3 w-3" />
          </Link>
        </span>
      </div>
    </Card>
  );
}

/** Compact scan-friendly row used on Dashboard "Recent Changes & Impact". */
export function OutcomeMiniRow({ change }: { change: Change }) {
  const d = primaryDelta(change);
  const pct = d ? deltaPct(d) : null;
  const label = statusLabel(change.impact_status);
  const tone = statusTone(change.impact_status);
  return (
    <Link
      href={`/outcomes/${change.id}`}
      className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-[12px] transition hover:border-slate-300"
    >
      <Badge tone={tone} size="sm" dot>
        {label}
      </Badge>
      <span className="font-medium text-slate-800">{change.change_type}</span>
      <span className="text-slate-500">· {change.target_system_name}</span>
      {d ? (
        <span className="text-slate-600">
          · {d.label}{" "}
          {pct != null ? (
            <span
              className={cn(
                "font-semibold tabular-nums",
                pct < 0 ? "text-emerald-700" : pct > 0 ? "text-rose-700" : "text-slate-600"
              )}
            >
              {pct > 0 ? "+" : ""}
              {pct.toFixed(1)}%
            </span>
          ) : null}
        </span>
      ) : null}
      <span className="ml-auto text-[11px] text-slate-500">
        {formatRelativeTime(change.executed_at)}
      </span>
    </Link>
  );
}

function statusLabel(s: ChangeLifecycleState): string {
  switch (s) {
    case "improvement_observed":
      return "Improvement observed";
    case "no_material_change":
      return "No material change";
    case "regression_detected":
      return "Regression detected";
    case "rollback_candidate":
      return "Rollback candidate";
    case "follow_up_required":
      return "Follow-up required";
    case "monitoring":
      return "Monitoring";
    case "executed":
      return "Executed";
    case "closed":
      return "Closed";
    case "approved":
      return "Approved";
    case "proposed":
      return "Proposed";
  }
}

function statusTone(
  s: ChangeLifecycleState
): "high" | "medium" | "low" | "info" | "neutral" | "outline" {
  switch (s) {
    case "regression_detected":
    case "rollback_candidate":
      return "high";
    case "follow_up_required":
      return "medium";
    case "improvement_observed":
      return "low";
    case "closed":
      return "low";
    case "monitoring":
    case "executed":
    case "approved":
      return "info";
    default:
      return "neutral";
  }
}
