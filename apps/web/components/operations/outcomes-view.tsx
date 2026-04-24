"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Search, TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { Change, ChangeLifecycleState, MetricDelta } from "@/lib/operations-types";
import { KpiCard } from "@/components/kpi-card";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChangeStateBadge, EnvironmentChip } from "./operations-badges";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  deltaDirection as computeDeltaDirection,
  deltaPct,
  outcomeLabel,
  outcomeNextStepShort,
  outcomeTone,
  verdictColor
} from "@/lib/governance-states";
import { appendReturnTo, routeToOutcome, routeToSystem } from "@/lib/routes";

type Segment =
  | "all"
  | "monitoring"
  | "improvement"
  | "follow_up"
  | "regression"
  | "closed";

type SegmentGroup = "attention" | "monitoring" | "resolved";

type SegmentDef = {
  id: Segment;
  label: string;
  group: SegmentGroup;
  caption: string;
};

const SEGMENTS: SegmentDef[] = [
  {
    id: "regression",
    label: "Rollback candidate",
    group: "attention",
    caption:
      "Immediate evidence lane: monitored metrics regressed, or Bob has flagged this for rollback. Prepare rollback through Action Center."
  },
  {
    id: "follow_up",
    label: "Follow-up required",
    group: "attention",
    caption:
      "Partial or ambiguous movement. Decide whether reviewer sign-off, a narrower fix, or extended monitoring is needed."
  },
  {
    id: "monitoring",
    label: "Under monitoring",
    group: "monitoring",
    caption:
      "Monitoring window is open. Outcome is not yet stable; keep measuring against the baseline before closing."
  },
  {
    id: "improvement",
    label: "Improvement observed",
    group: "resolved",
    caption:
      "Monitored metrics moved in the expected direction beyond the noise threshold. Ready to close with reviewer sign-off."
  },
  {
    id: "closed",
    label: "Closed · no material change",
    group: "resolved",
    caption:
      "Monitoring ended with no material movement, or the outcome was closed out. Preserved for audit and trend learning."
  },
  {
    id: "all",
    label: "All",
    group: "resolved",
    caption: "Every governed change in the selected window, regardless of state."
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
        (c.follow_up_required &&
          c.impact_status !== "regression_detected" &&
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scoped = useMemo(
    () =>
      systemFilter ? changes.filter((c) => c.target_system_id === systemFilter) : changes,
    [changes, systemFilter]
  );

  const [segment, setSegment] = useState<Segment>("monitoring");
  const [query, setQuery] = useState(searchParams?.get("q") ?? "");
  const [env, setEnv] = useState<string>(searchParams?.get("env") ?? "all");
  const [changeType, setChangeType] = useState<string>(
    searchParams?.get("type") ?? "all"
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    const t = q.get("tab") as Segment | null;
    if (t && SEGMENTS.some((s) => s.id === t)) setSegment(t);
  }, []);

  useEffect(() => {
    const p = new URLSearchParams(searchParams?.toString() ?? "");
    if (segment === "monitoring") p.delete("tab");
    else p.set("tab", segment);
    if (query.trim()) p.set("q", query.trim());
    else p.delete("q");
    if (env === "all") p.delete("env");
    else p.set("env", env);
    if (changeType === "all") p.delete("type");
    else p.set("type", changeType);
    const next = p.toString();
    const current = searchParams?.toString() ?? "";
    if (next !== current) {
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    }
  }, [segment, query, env, changeType, searchParams, pathname, router]);

  const returnTo = searchParams?.toString()
    ? `${pathname}?${searchParams.toString()}`
    : pathname;

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
    const noMaterial = scoped.filter(
      (c) => c.impact_status === "no_material_change"
    ).length;
    return {
      monitoring: counts.monitoring,
      improvement: counts.improvement,
      followUp: counts.follow_up,
      regression: counts.regression,
      rollback,
      noMaterial
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

  const attentionSegs = SEGMENTS.filter((s) => s.group === "attention");
  const monitoringSegs = SEGMENTS.filter((s) => s.group === "monitoring");
  const resolvedSegs = SEGMENTS.filter((s) => s.group === "resolved");

  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-[12px] text-slate-600">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium text-slate-900">
            Operational job: verify executed changes here; route rollback or
            follow-up back through governed action.
          </p>
          <p className="text-[11px] text-slate-500">
            Action Center governs → Outcomes measures
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Rollback candidates"
          value={kpis.rollback}
          caption="Regressed beyond noise; rollback recommended"
          tone={kpis.rollback > 0 ? "urgent" : "neutral"}
          highlight={kpis.rollback > 0}
        />
        <KpiCard
          label="Follow-up required"
          value={kpis.followUp}
          caption="Partial or ambiguous movement"
          tone={kpis.followUp > 0 ? "warning" : "neutral"}
          highlight={kpis.followUp > 0}
        />
        <KpiCard
          label="Under monitoring"
          value={kpis.monitoring}
          caption="Window open · evaluating against baseline"
        />
        <KpiCard
          label="Improvement observed"
          value={kpis.improvement}
          caption="Moved as expected · ready to close"
          tone={kpis.improvement > 0 ? "ok" : "neutral"}
        />
        <KpiCard
          label="No material change"
          value={kpis.noMaterial}
          caption="Closed with neither gain nor regression"
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-200 px-2 pt-1.5 pb-1.5">
          <GroupLabel>Needs attention</GroupLabel>
          {attentionSegs.map((s) => (
            <SegmentTab
              key={s.id}
              active={segment === s.id}
              label={s.label}
              count={counts[s.id]}
              onClick={() => setSegment(s.id)}
              variant={s.id === "regression" && counts[s.id] > 0 ? "urgent" : "default"}
            />
          ))}
          <span className="mx-1 h-4 w-px bg-slate-200" aria-hidden />
          <GroupLabel>Monitoring</GroupLabel>
          {monitoringSegs.map((s) => (
            <SegmentTab
              key={s.id}
              active={segment === s.id}
              label={s.label}
              count={counts[s.id]}
              onClick={() => setSegment(s.id)}
            />
          ))}
          <span className="mx-1 h-4 w-px bg-slate-200" aria-hidden />
          <GroupLabel>Resolved</GroupLabel>
          {resolvedSegs.map((s) => (
            <SegmentTab
              key={s.id}
              active={segment === s.id}
              label={s.label}
              count={counts[s.id]}
              onClick={() => setSegment(s.id)}
            />
          ))}
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

        <div className="flex items-center justify-between gap-3 px-3 py-2 text-[11px]">
          <p className="text-slate-500">{seg.caption}</p>
          <p className="shrink-0 tabular-nums text-slate-400">
            {filtered.length} of {counts[segment]} {counts[segment] === 1 ? "outcome" : "outcomes"}
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            No outcomes in this view.
          </div>
        ) : (
          filtered.map((c) => (
            <OutcomeRow key={c.id} change={c} returnTo={returnTo} />
          ))
        )}
      </div>
    </section>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="select-none pl-1 pr-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
      {children}
    </span>
  );
}

function SegmentTab({
  active,
  label,
  count,
  onClick,
  variant = "default"
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
  variant?: "default" | "urgent";
}) {
  const activeCls = active
    ? "bg-slate-900 text-white"
    : variant === "urgent" && count > 0
      ? "text-rose-700 hover:bg-rose-50"
      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900";
  const countCls = active
    ? "bg-white/20 text-white"
    : variant === "urgent" && count > 0
      ? "bg-rose-100 text-rose-700"
      : "bg-slate-100 text-slate-600";
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "relative rounded-md px-2.5 py-1.5 text-xs font-medium transition " +
        activeCls
      }
    >
      {label}
      <span
        className={
          "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums " +
          countCls
        }
      >
        {count}
      </span>
    </button>
  );
}

function primaryDelta(change: Change): MetricDelta | null {
  return change.metric_deltas[0] ?? null;
}

export function OutcomeRow({
  change,
  returnTo
}: {
  change: Change;
  returnTo?: string;
}) {
  const d = primaryDelta(change);
  const pct = d ? deltaPct(d) : null;
  const dir = d ? computeDeltaDirection(d) : "flat";
  const DeltaIcon = dir === "improved" ? TrendingDown : dir === "worse" ? TrendingUp : Minus;
  const deltaTone =
    dir === "improved"
      ? "text-emerald-700"
      : dir === "worse"
        ? "text-rose-700"
        : "text-slate-500";
  const step = outcomeNextStepShort(change);

  return (
    <Card density="compact" className="space-y-2.5">
      {/* Row 1: state + change type + system + executed meta */}
      <div className="flex flex-wrap items-center gap-2">
        <ChangeStateBadge state={change.impact_status} />
        <EnvironmentChip env={change.environment} />
        <span className="text-[13px] font-medium text-slate-900">
          {change.change_type}
        </span>
        <Link
          href={routeToSystem(change.target_system_id)}
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

      {/* Row 2: Expected vs Actual grid with primary delta pill top-right */}
      <div className="relative grid gap-3 rounded-md border border-slate-200 bg-slate-50/50 p-2.5 md:grid-cols-2">
        {d && pct != null ? (
          <div className="pointer-events-none absolute right-2.5 top-2.5">
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-md bg-white px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-slate-200 tabular-nums",
                deltaTone
              )}
            >
              <DeltaIcon className="h-3 w-3" />
              {pct > 0 ? "+" : ""}
              {pct.toFixed(1)}%
            </span>
          </div>
        ) : null}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Bob expected
          </p>
          <p className="mt-0.5 text-[12px] text-slate-700">
            {change.expected_impact_summary}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            What actually happened
          </p>
          <p className="mt-0.5 text-[12px] text-slate-700">
            {change.actual_outcome_summary}
          </p>
        </div>
      </div>

      {/* Row 3: metric deltas + next step + CTA */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-slate-100 pt-2 text-[11px] text-slate-600">
        {d ? (
          <span className="inline-flex items-center gap-1">
            <span className="text-slate-500">{d.label}</span>
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
          <span className={cn("font-medium", verdictColor[step.tone])}>
            Next: {step.label}
          </span>
          <Link
            href={appendReturnTo(routeToOutcome(change.id), returnTo)}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:border-slate-300"
          >
            Measure outcome
            <ArrowRight className="h-3 w-3" />
          </Link>
        </span>
      </div>
    </Card>
  );
}

/**
 * Compact scan-friendly row used on Dashboard "Recent Changes & Impact".
 * Laid out as a responsive grid so status badge, change label, system,
 * measured delta, and recency align vertically across stacked rows.
 */
export function OutcomeMiniRow({ change }: { change: Change }) {
  const d = primaryDelta(change);
  const pct = d ? deltaPct(d) : null;
  const label = outcomeLabel(change.impact_status);
  const tone = outcomeTone(change.impact_status);
  return (
    <Link
      href={routeToOutcome(change.id)}
      className="group grid grid-cols-[140px_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-[12px] transition hover:border-slate-300 hover:bg-slate-50/60"
    >
      <Badge tone={tone} size="sm" dot>
        {label}
      </Badge>
      <div className="min-w-0">
        <p className="truncate">
          <span className="font-medium text-slate-800">
            {change.change_type}
          </span>
          <span className="text-slate-500"> · {change.target_system_name}</span>
        </p>
        {d ? (
          <p className="mt-0.5 truncate text-[11px] text-slate-500">
            {d.label}
            {pct != null ? (
              <>
                {" · "}
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    pct < 0
                      ? "text-emerald-700"
                      : pct > 0
                        ? "text-rose-700"
                        : "text-slate-600"
                  )}
                >
                  {pct > 0 ? "+" : ""}
                  {pct.toFixed(1)}%
                </span>
              </>
            ) : null}
          </p>
        ) : null}
      </div>
      <span className="whitespace-nowrap text-[11px] tabular-nums text-slate-500 group-hover:text-slate-700">
        {formatRelativeTime(change.executed_at)}
      </span>
    </Link>
  );
}

// Re-export label/tone helpers for any other import sites that relied on
// the previously file-local versions.
export { outcomeLabel as statusLabel, outcomeTone as statusTone };

// Unused type is kept available for downstream imports.
export type { ChangeLifecycleState };
