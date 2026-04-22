"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { Action, RiskLevel } from "@/lib/action-types";
import type { Change } from "@/lib/operations-types";
import { Select } from "@/components/ui/select";
import { KpiCard } from "@/components/kpi-card";
import { ActionCard } from "./action-card";
import { actionTypeLabel } from "./index";
import { ChangeImpactMiniRow } from "@/components/operations/change-impact";

type Segment =
  | "pending"
  | "ready"
  | "executed"
  | "monitoring"
  | "blocked"
  | "rollback"
  | "closed_rejected";

type Props = {
  actions: Action[];
  changes?: Change[];
  defaultTab?: Segment;
};

const SEGMENTS: { id: Segment; label: string; caption: string }[] = [
  {
    id: "pending",
    label: "Pending approval",
    caption: "Bob-prepared changes awaiting a human governance decision."
  },
  {
    id: "ready",
    label: "Approved · ready to execute",
    caption:
      "Approved but not yet executed — awaiting owner handoff or allowed execution window."
  },
  {
    id: "executed",
    label: "Executed",
    caption: "Recently executed actions; outcome window may still be open."
  },
  {
    id: "monitoring",
    label: "Follow-up · monitoring outcome",
    caption:
      "Executed actions being monitored for post-action improvement, regression, or reviewer sign-off."
  },
  {
    id: "blocked",
    label: "Policy-blocked",
    caption:
      "Actions Bob prepared that were blocked by policy (no config access, dual approval missing, restricted type, maintenance window, etc.). Kept visible so the blocking reason is auditable."
  },
  {
    id: "rollback",
    label: "Rollback candidates",
    caption:
      "Executed changes that regressed after monitoring. Bob has flagged these as rollback candidates."
  },
  {
    id: "closed_rejected",
    label: "Rejected / closed",
    caption: "Rejected or policy-escalated actions preserved for audit."
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
      return ex === "executed" || ex === "closed";
    case "monitoring":
      return ex === "monitoring_outcome" || ex === "follow_up_required";
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
  const [segment, setSegment] = useState<Segment>(defaultTab ?? "pending");
  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState<RiskLevel | "all">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

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
    // Honor ?tab= deep links (e.g. Dashboard "View outcomes")
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
      monitoring: 0,
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
    const regression = actions.filter(
      (a) => a.monitoring_status === "regression_detected" || a.monitoring_status === "rollback_recommended"
    ).length;
    return {
      pending: counts.pending,
      ready: counts.ready,
      monitoring: counts.monitoring,
      highRiskPending,
      regression
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

  return (
    <section className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Pending approval"
          value={kpis.pending}
          caption="Awaiting a human governance decision"
          tone={kpis.pending > 0 ? "warning" : "neutral"}
          highlight={kpis.pending > 0}
        />
        <KpiCard
          label="High-risk pending"
          value={kpis.highRiskPending}
          caption="High-risk actions requiring dual approval"
          tone={kpis.highRiskPending > 0 ? "urgent" : "neutral"}
          highlight={kpis.highRiskPending > 0}
        />
        <KpiCard
          label="Ready to execute"
          value={kpis.ready}
          caption="Approved; awaiting execution window"
        />
        <KpiCard
          label="Monitoring outcome"
          value={kpis.monitoring}
          caption="Post-action windows still open"
        />
        <KpiCard
          label="Regression / rollback"
          value={kpis.regression}
          caption="Post-action outcomes to review"
          tone={kpis.regression > 0 ? "urgent" : "ok"}
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
                    (active
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-600")
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

        <div className="px-3 py-2 text-[11px] text-slate-500">{seg.caption}</div>
      </div>

      <div className="space-y-2.5">
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            No actions match the current filters in this view.
          </div>
        ) : (
          filtered.map((a) => (
            <div key={a.id} className="space-y-1.5">
              <ActionCard action={a} />
              {changesByActionId.get(a.id) ? (
                <ChangeImpactMiniRow change={changesByActionId.get(a.id)!} />
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
