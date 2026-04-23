"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import type { Action, RiskLevel } from "@/lib/action-types";
import type { Change } from "@/lib/operations-types";
import { Select } from "@/components/ui/select";
import { KpiCard } from "@/components/kpi-card";
import { ActionCard } from "./action-card";
import { actionTypeLabel } from "./index";
import { OutcomesStrip } from "@/components/operations/outcomes-strip";
import { appendReturnTo, routeToAction, routeToOutcome } from "@/lib/routes";

type Segment =
  | "pending"
  | "ready"
  | "blocked"
  | "executed"
  | "rollback"
  | "closed_rejected";

type SegmentGroup = "decision" | "post_execution";

type Props = {
  actions: Action[];
  changes?: Change[];
  defaultTab?: Segment;
};

type SegmentDef = {
  id: Segment;
  label: string;
  group: SegmentGroup;
  caption: string;
};

const SEGMENTS: SegmentDef[] = [
  {
    id: "pending",
    label: "Awaiting approval",
    group: "decision",
    caption:
      "Bob-prepared changes waiting on a human governance decision. Nothing is executed until approved."
  },
  {
    id: "ready",
    label: "Approved",
    group: "decision",
    caption:
      "Approved within policy. Awaiting the permitted execution window or owner handoff."
  },
  {
    id: "blocked",
    label: "Policy-blocked",
    group: "decision",
    caption:
      "Blocked by policy — missing approver, restricted type, maintenance window, or no config access. Kept visible so the blocking reason is auditable."
  },
  {
    id: "executed",
    label: "Executed",
    group: "post_execution",
    caption:
      "Executed within approved scope. Post-execution impact is measured in Outcomes."
  },
  {
    id: "rollback",
    label: "Rollback candidates",
    group: "post_execution",
    caption:
      "Executed changes that regressed on monitored metrics. Flagged for rollback or scoped review."
  },
  {
    id: "closed_rejected",
    label: "Rejected · closed",
    group: "post_execution",
    caption: "Rejected, policy-escalated, or reverted actions preserved for audit."
  }
];

function inSegment(
  action: Action,
  seg: Segment,
  rollbackActionIds: Set<string>
): boolean {
  const ex = action.execution_status;
  switch (seg) {
    case "pending":
      return (
        (ex === "awaiting_approval" || ex === "drafted" || ex === "prepared") &&
        action.allowed_by_policy !== false
      );
    case "ready":
      return ex === "ready_to_execute" || ex === "approved";
    case "executed":
      return (
        ex === "executed" ||
        ex === "closed" ||
        ex === "monitoring_outcome" ||
        ex === "follow_up_required"
      );
    case "blocked":
      return action.allowed_by_policy === false;
    case "rollback":
      return rollbackActionIds.has(action.id);
    case "closed_rejected":
      return (
        ex === "rejected" ||
        ex === "reverted" ||
        action.approval_status === "rejected" ||
        action.approval_status === "escalated"
      );
  }
}

export function ActionCenterView({ actions, changes = [], defaultTab }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [segment, setSegment] = useState<Segment>(defaultTab ?? "pending");
  const [query, setQuery] = useState(searchParams?.get("q") ?? "");
  const [risk, setRisk] = useState<RiskLevel | "all">(
    (searchParams?.get("risk") as RiskLevel | "all") ?? "all"
  );
  const [typeFilter, setTypeFilter] = useState(searchParams?.get("type") ?? "all");

  useEffect(() => {
    const p = new URLSearchParams(searchParams?.toString() ?? "");
    if (segment === "pending") p.delete("tab");
    else p.set("tab", segment);
    if (query.trim()) p.set("q", query.trim());
    else p.delete("q");
    if (risk === "all") p.delete("risk");
    else p.set("risk", risk);
    if (typeFilter === "all") p.delete("type");
    else p.set("type", typeFilter);
    const next = p.toString();
    const current = searchParams?.toString() ?? "";
    if (next !== current) {
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    }
  }, [segment, query, risk, typeFilter, searchParams, pathname, router]);

  const returnTo = searchParams?.toString()
    ? `${pathname}?${searchParams.toString()}`
    : pathname;

  const changesByActionId = useMemo(() => {
    const map = new Map<string, Change>();
    changes.forEach((c) => {
      if (c.source_action_id) map.set(c.source_action_id, c);
    });
    return map;
  }, [changes]);

  const rollbackActionIds = useMemo(() => {
    return new Set(
      changes
        .filter(
          (c) =>
            c.rollback_recommended ||
            c.impact_status === "rollback_candidate" ||
            c.impact_status === "regression_detected"
        )
        .map((c) => c.source_action_id!)
        .filter(Boolean)
    );
  }, [changes]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    const t = q.get("tab") as Segment | null;
    if (t && SEGMENTS.some((s) => s.id === t)) setSegment(t);
  }, []);

  const counts = useMemo(() => {
    const base: Record<Segment, number> = {
      pending: 0,
      ready: 0,
      executed: 0,
      blocked: 0,
      rollback: 0,
      closed_rejected: 0
    };
    for (const a of actions) {
      for (const s of SEGMENTS) {
        if (inSegment(a, s.id, rollbackActionIds)) base[s.id] += 1;
      }
    }
    return base;
  }, [actions, rollbackActionIds]);

  const kpis = useMemo(() => {
    const highRiskPending = actions.filter(
      (a) => a.risk_level === "high" && inSegment(a, "pending", rollbackActionIds)
    ).length;
    return {
      pending: counts.pending,
      ready: counts.ready,
      blocked: counts.blocked,
      rollback: counts.rollback,
      highRiskPending
    };
  }, [actions, counts, rollbackActionIds]);

  const actionTypes = useMemo(() => {
    const set = new Set<string>();
    actions.forEach((a) => set.add(a.action_type));
    return Array.from(set).sort();
  }, [actions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return actions.filter((a) => {
      if (!inSegment(a, segment, rollbackActionIds)) return false;
      if (risk !== "all" && a.risk_level !== risk) return false;
      if (typeFilter !== "all" && a.action_type !== typeFilter) return false;
      if (q) {
        const hay = `${a.title} ${a.prepared_change_summary} ${a.target_system_name ?? ""} ${a.required_approver} ${a.recommended_owner}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [actions, segment, risk, typeFilter, query, rollbackActionIds]);

  const seg = SEGMENTS.find((s) => s.id === segment)!;
  const decisionSegs = SEGMENTS.filter((s) => s.group === "decision");
  const postExecSegs = SEGMENTS.filter((s) => s.group === "post_execution");

  return (
    <section className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Awaiting approval"
          value={kpis.pending}
          caption="Drafted by Bob · approver pending"
          tone={kpis.pending > 0 ? "warning" : "neutral"}
          highlight={kpis.pending > 0}
        />
        <KpiCard
          label="High-risk awaiting"
          value={kpis.highRiskPending}
          caption="Dual approval required"
          tone={kpis.highRiskPending > 0 ? "urgent" : "neutral"}
          highlight={kpis.highRiskPending > 0}
        />
        <KpiCard
          label="Approved"
          value={kpis.ready}
          caption="Cleared for bounded execution"
        />
        <KpiCard
          label="Policy-blocked"
          value={kpis.blocked}
          caption="Held by policy · reason retained"
          tone={kpis.blocked > 0 ? "warning" : "neutral"}
        />
        <KpiCard
          label="Rollback candidates"
          value={kpis.rollback}
          caption="Regressed post-execution"
          tone={kpis.rollback > 0 ? "urgent" : "neutral"}
          highlight={kpis.rollback > 0}
        />
      </div>

      {changes.length > 0 ? (
        <OutcomesStrip changes={changes} density="compact" />
      ) : null}

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-200 px-2 pt-1.5 pb-1.5">
          <GroupLabel>Decision</GroupLabel>
          {decisionSegs.map((s) => (
            <SegmentTab
              key={s.id}
              active={segment === s.id}
              label={s.label}
              count={counts[s.id]}
              onClick={() => setSegment(s.id)}
            />
          ))}
          <span className="mx-1 h-4 w-px bg-slate-200" aria-hidden />
          <GroupLabel>Post-execution</GroupLabel>
          {postExecSegs.map((s) => (
            <SegmentTab
              key={s.id}
              active={segment === s.id}
              label={s.label}
              count={counts[s.id]}
              onClick={() => setSegment(s.id)}
              variant={s.id === "rollback" && counts[s.id] > 0 ? "urgent" : "default"}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2.5">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search actions, systems, approvers…"
              className="h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
            />
          </div>
          <Select
            value={risk}
            onChange={(e) => setRisk(e.target.value as RiskLevel | "all")}
          >
            <option value="all">Any risk</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </Select>
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">Any action type</option>
            {actionTypes.map((t) => (
              <option key={t} value={t}>
                {actionTypeLabel(t)}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex items-center justify-between gap-3 px-3 py-2 text-[11px]">
          <p className="text-slate-500">{seg.caption}</p>
          <p className="shrink-0 tabular-nums text-slate-400">
            {filtered.length} of {counts[segment]} {counts[segment] === 1 ? "action" : "actions"}
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            No actions match the current filters in this view.
          </div>
        ) : (
          filtered.map((a) => (
            <div key={a.id} className="space-y-1.5">
              <ActionCard
                action={a}
                detailHref={appendReturnTo(routeToAction(a.id), returnTo)}
              />
              {segment === "rollback" && changesByActionId.get(a.id) ? (
                <RollbackContextRow change={changesByActionId.get(a.id)!} />
              ) : null}
            </div>
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

function RollbackContextRow({ change }: { change: Change }) {
  const primary = change.metric_deltas[0];
  const pct =
    primary && primary.before != null && primary.after != null && primary.before !== 0
      ? ((primary.after - primary.before) / primary.before) * 100
      : null;
  return (
    <div className="rounded-md border border-rose-100 bg-rose-50/60 px-3 py-2 text-[12px] text-rose-900">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-rose-700">
          Why rollback
        </span>
        <span className="text-rose-900">{change.actual_outcome_summary}</span>
        {primary && pct != null ? (
          <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-white px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-rose-700 ring-1 ring-rose-200">
            {primary.label} {pct > 0 ? "+" : ""}
            {pct.toFixed(1)}%
          </span>
        ) : null}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
        {change.version_before && change.version_after ? (
          <span className="text-rose-900/80">
            Version {change.version_after} → rollback target{" "}
            <span className="font-mono font-semibold">{change.version_before}</span>
          </span>
        ) : null}
        <a
          href={routeToOutcome(change.id)}
          className="ml-auto font-medium text-rose-700 hover:text-rose-900 hover:underline"
        >
          Open outcome →
        </a>
      </div>
    </div>
  );
}
