"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { BobInvestigation, InvestigationStatus, TargetType } from "@/lib/bob-types";
import { InvestigationRow } from "./investigation-row";
import { Select } from "@/components/ui/select";
import { KpiCard } from "@/components/kpi-card";
import { BobEyebrow } from "./bob-icon";
import { investigationStatusLabel } from "./bob-badges";

const STATUS_OPTIONS: InvestigationStatus[] = [
  "awaiting_approval",
  "ready_for_review",
  "draft",
  "approved",
  "monitoring_outcome",
  "executed",
  "rejected"
];

const TARGET_OPTIONS: TargetType[] = ["incident", "system", "control"];

type Props = {
  investigations: BobInvestigation[];
  defaultStatusFilter?: string;
};

type StatusFilter = "all" | "open" | InvestigationStatus;
type TargetFilter = "all" | TargetType;
type SortKey = "priority" | "updated" | "confidence";

const VALID_STATUS_FILTERS: StatusFilter[] = [
  "all",
  "open",
  "awaiting_approval",
  "ready_for_review",
  "draft",
  "approved",
  "monitoring_outcome",
  "executed",
  "rejected"
];

export function BobCopilotView({
  investigations,
  defaultStatusFilter
}: Props) {
  const initialStatus: StatusFilter =
    defaultStatusFilter &&
    VALID_STATUS_FILTERS.includes(defaultStatusFilter as StatusFilter)
      ? (defaultStatusFilter as StatusFilter)
      : "open";
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
  const [targetFilter, setTargetFilter] = useState<TargetFilter>("all");
  const [confidenceFilter, setConfidenceFilter] = useState<"all" | "high" | "medium" | "low">(
    "all"
  );
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("priority");

  const openStatuses: InvestigationStatus[] = [
    "awaiting_approval",
    "ready_for_review",
    "draft"
  ];

  const kpis = useMemo(() => {
    const open = investigations.filter((i) => openStatuses.includes(i.status));
    const awaiting = investigations.filter((i) => i.status === "awaiting_approval");
    const pendingApprovals = investigations.reduce(
      (acc, inv) =>
        acc + inv.recommendations.filter((r) => r.approval_status === "pending").length,
      0
    );
    const recurring = investigations.filter((i) => i.recurring_issue_flag).length;
    return {
      open: open.length,
      awaiting: awaiting.length,
      pendingApprovals,
      recurring
    };
  }, [investigations]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return investigations.filter((inv) => {
      if (statusFilter === "open" && !openStatuses.includes(inv.status)) return false;
      if (
        statusFilter !== "all" &&
        statusFilter !== "open" &&
        inv.status !== statusFilter
      )
        return false;
      if (targetFilter !== "all" && inv.target_type !== targetFilter) return false;
      if (confidenceFilter !== "all" && inv.confidence !== confidenceFilter) return false;
      if (q) {
        const hay = `${inv.title} ${inv.target_label} ${inv.summary} ${inv.signal_type ?? ""} ${inv.suggested_owner}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [investigations, statusFilter, targetFilter, confidenceFilter, query]);

  const sorted = useMemo(() => {
    const priority: Record<InvestigationStatus, number> = {
      awaiting_approval: 0,
      ready_for_review: 1,
      draft: 2,
      approved: 3,
      monitoring_outcome: 4,
      executed: 5,
      rejected: 6
    };
    const copy = [...filtered];
    if (sort === "priority") {
      copy.sort((a, b) => {
        const d = priority[a.status] - priority[b.status];
        if (d !== 0) return d;
        return (
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
      });
    } else if (sort === "updated") {
      copy.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    } else {
      copy.sort((a, b) => b.confidence_score - a.confidence_score);
    }
    return copy;
  }, [filtered, sort]);

  return (
    <section className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Open investigations"
          value={kpis.open}
          caption="Draft, ready, or awaiting approval"
          highlight={kpis.open > 0}
        />
        <KpiCard
          label="Awaiting approval"
          value={kpis.awaiting}
          caption="Requires a governance decision"
          tone={kpis.awaiting > 0 ? "warning" : "neutral"}
          highlight={kpis.awaiting > 0}
        />
        <KpiCard
          label="Pending recommendations"
          value={kpis.pendingApprovals}
          caption="Held for approval"
        />
        <KpiCard
          label="Recurring patterns"
          value={kpis.recurring}
          caption="Repeat governance signals"
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search investigations, systems, controls…"
              className="h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="open">Open</option>
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {investigationStatusLabel(s)}
              </option>
            ))}
          </Select>
          <Select
            value={targetFilter}
            onChange={(e) => setTargetFilter(e.target.value as TargetFilter)}
          >
            <option value="all">Any target</option>
            {TARGET_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t === "incident" ? "Incident" : t === "system" ? "System" : "Control"}
              </option>
            ))}
          </Select>
          <Select
            value={confidenceFilter}
            onChange={(e) =>
              setConfidenceFilter(
                e.target.value as "all" | "high" | "medium" | "low"
              )
            }
          >
            <option value="all">Any confidence</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="priority">Sort: Priority</option>
            <option value="updated">Sort: Recently updated</option>
            <option value="confidence">Sort: Confidence</option>
          </Select>
        </div>
        <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <BobEyebrow label="Investigation queue" />
            <span>
              Showing {sorted.length} of {investigations.length} investigations
            </span>
          </div>
          <span>Mock analysis; no live model calls.</span>
        </div>
      </div>

      <div className="space-y-2.5">
        {sorted.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            No investigations match the current filters.
          </div>
        ) : (
          sorted.map((inv) => (
            <InvestigationRow key={inv.id} investigation={inv} />
          ))
        )}
      </div>
    </section>
  );
}
