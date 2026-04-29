"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { formatInteger } from "@/lib/format";
import { humanizeLabel } from "@/lib/present";
import { withAiScope, type AiScopeId } from "@/lib/ai-scope";
import {
  appendReturnTo,
  routeToBobForTarget,
  routeToIncident,
  routeToIncidentsForSystem,
  routeToSystem,
  routes
} from "@/lib/routes";

type Props = {
  systems: any[];
  incidents: any[];
  changes: any[];
  scope: AiScopeId;
};

const CATEGORY_PRESET = [
  "Markets & Treasury",
  "Enterprise Analytics",
  "Compliance",
  "Customer Operations",
  "Engineering",
  "Security",
  "Productivity"
];

type PostureFilter = "all" | "critical" | "high" | "watchlist" | "healthy";
type SystemPosture = "critical" | "high" | "watchlist" | "healthy";

type ModelRow = {
  system: any;
  category: string;
  owner: string;
  postureLabel: string;
  postureFilter: SystemPosture;
  openIncidents: any[];
  allIncidents: any[];
  openCount: number;
  criticalHighCount: number;
  oldestOpenTs: number | null;
  recentActivityTs: number | null;
  issues30d: number;
  fixes30d: number;
};

function toTs(value: any): number | null {
  if (!value) return null;
  const n = new Date(value).getTime();
  return Number.isFinite(n) ? n : null;
}

function daysAgo(ts: number | null): number | null {
  if (ts == null) return null;
  return Math.max(0, Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24)));
}

function postureFilterFromSystem(system: any): SystemPosture {
  const p = String(system?.risk_posture ?? "").toLowerCase();
  if (p === "critical") return "critical";
  if (p === "at_risk" || p === "high") return "high";
  if (p === "watch" || p === "watchlist") return "watchlist";
  return "healthy";
}

function postureLabel(filter: SystemPosture): string {
  if (filter === "watchlist") return "Watchlist";
  return humanizeLabel(filter);
}

function postureTone(posture: SystemPosture): "high" | "medium" | "low" | "neutral" {
  if (posture === "critical" || posture === "high") return "high";
  if (posture === "watchlist") return "medium";
  if (posture === "healthy") return "low";
  return "neutral";
}

function statusTextClass(posture: SystemPosture): string {
  if (posture === "critical" || posture === "high") {
    return "font-bold text-rose-700";
  }
  if (posture === "watchlist") {
    return "font-semibold text-amber-700";
  }
  return "font-semibold text-slate-700";
}

function severityRank(sev: string): number {
  if (sev === "critical") return 4;
  if (sev === "high") return 3;
  if (sev === "medium") return 2;
  if (sev === "low") return 1;
  return 0;
}

function statusRank(incident: any): number {
  if (incident.escalation_status === "escalated") return 4;
  if (incident.review_required) return 3;
  const s = String(incident.incident_status ?? "").toLowerCase();
  if (s === "pending") return 2;
  if (s === "open") return 1;
  return 0;
}

function incidentAgeLabel(incident: any): string {
  const d = daysAgo(toTs(incident.created_at));
  if (d == null) return "—";
  if (d === 0) return "<1d";
  return `${d}d`;
}

function incidentRecencyLabel(incident: any): string {
  const ts = toTs(incident.created_at);
  if (ts == null) return "—";
  const diffMs = Date.now() - ts;
  const mins = Math.max(0, Math.floor(diffMs / (1000 * 60)));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function isNewIncident(incident: any): boolean {
  const ts = toTs(incident.created_at);
  if (ts == null) return false;
  return Date.now() - ts <= 24 * 60 * 60 * 1000;
}

function incidentNextAction(incident: any): string {
  if (incident.escalation_status === "escalated") return "Escalation follow-up";
  if (incident.review_required) return "Review decision";
  const s = String(incident.incident_status ?? "").toLowerCase();
  if (s === "pending") return "Triage owner";
  if (s === "open") return "Open investigation";
  if (s === "closed") return "Verify outcome";
  return "Monitor";
}

function incidentStatusTag(incident: any): string {
  const s = String(incident.incident_status ?? "").toLowerCase();
  if (s === "pending") return "Pending";
  if (s === "closed") return "Closed";
  if (s === "open") return "Open";
  return humanizeLabel(s || "open");
}

function categoryForSystem(system: any): string {
  return (
    system?.business_function ||
    system?.category ||
    system?.domain ||
    system?.portfolio ||
    "Uncategorized"
  );
}

function ownerForSystem(system: any, incidents: any[]): string {
  return (
    system?.owner ||
    system?.control_owner ||
    incidents.find((i) => i.owner_team)?.owner_team ||
    "Governance Operations"
  );
}

function normalizeFixTs(change: any): number | null {
  return (
    toTs(change.closed_at) ??
    toTs(change.resolved_at) ??
    toTs(change.completed_at) ??
    toTs(change.updated_at) ??
    toTs(change.created_at)
  );
}

export function ModelRiskPivot({ systems, incidents, changes, scope }: Props) {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [postureFilter, setPostureFilter] = useState<Exclude<PostureFilter, "healthy">>("all");
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null);

  const modelRows = useMemo<ModelRow[]>(() => {
    const now = Date.now();
    const cutoff30d = now - 30 * 24 * 60 * 60 * 1000;
    const incidentsBySystem = new Map<string, any[]>();
    for (const inc of incidents) {
      const arr = incidentsBySystem.get(inc.system_id) ?? [];
      arr.push(inc);
      incidentsBySystem.set(inc.system_id, arr);
    }
    const changesBySystem = new Map<string, any[]>();
    for (const c of changes) {
      const id = c.target_system_id;
      if (!id) continue;
      const arr = changesBySystem.get(id) ?? [];
      arr.push(c);
      changesBySystem.set(id, arr);
    }

    const rows = systems.map((system) => {
      const allIncidents = incidentsBySystem.get(system.id) ?? [];
      const openIncidents = allIncidents.filter((i) => i.incident_status !== "closed");
      const changeRows = changesBySystem.get(system.id) ?? [];
      const oldTsCandidates = openIncidents.map((i) => toTs(i.created_at)).filter(Boolean) as number[];
      const oldestOpenTs = oldTsCandidates.length ? Math.min(...oldTsCandidates) : null;
      const recentIncidentTs = allIncidents.map((i) => toTs(i.created_at)).filter(Boolean) as number[];
      const recentFixTs = changeRows.map((c) => normalizeFixTs(c)).filter(Boolean) as number[];
      const recentActivityTs =
        [...recentIncidentTs, ...recentFixTs].length > 0
          ? Math.max(...([...recentIncidentTs, ...recentFixTs] as number[]))
          : null;
      const criticalHighCount = openIncidents.filter(
        (i) => i.severity === "critical" || i.severity === "high"
      ).length;
      const issues30d = allIncidents.filter((i) => {
        const ts = toTs(i.created_at);
        return ts != null && ts >= cutoff30d;
      }).length;
      const fixes30d = changeRows.filter((c) => {
        const ts = normalizeFixTs(c);
        const closedLike =
          c.impact_status === "improvement_observed" ||
          c.impact_status === "closed" ||
          c.impact_status === "no_material_change";
        return ts != null && ts >= cutoff30d && closedLike;
      }).length;
      const posture = postureFilterFromSystem(system);

      return {
        system,
        category: categoryForSystem(system),
        owner: ownerForSystem(system, allIncidents),
        postureLabel: postureLabel(posture),
        postureFilter: posture,
        openIncidents,
        allIncidents,
        openCount: openIncidents.length,
        criticalHighCount,
        oldestOpenTs,
        recentActivityTs,
        issues30d,
        fixes30d
      };
    });

    rows.sort((a, b) => {
      const postureRank =
        (a.postureFilter === "critical" ? 4 : a.postureFilter === "high" ? 3 : a.postureFilter === "watchlist" ? 2 : 1) -
        (b.postureFilter === "critical" ? 4 : b.postureFilter === "high" ? 3 : b.postureFilter === "watchlist" ? 2 : 1);
      if (postureRank !== 0) return -postureRank;
      if (a.openCount !== b.openCount) return b.openCount - a.openCount;
      if (a.criticalHighCount !== b.criticalHighCount) return b.criticalHighCount - a.criticalHighCount;
      if (a.oldestOpenTs !== b.oldestOpenTs) {
        if (a.oldestOpenTs == null) return 1;
        if (b.oldestOpenTs == null) return -1;
        return a.oldestOpenTs - b.oldestOpenTs;
      }
      if (a.recentActivityTs !== b.recentActivityTs) {
        if (a.recentActivityTs == null) return 1;
        if (b.recentActivityTs == null) return -1;
        return b.recentActivityTs - a.recentActivityTs;
      }
      return String(a.system.use_case ?? a.system.name).localeCompare(
        String(b.system.use_case ?? b.system.name)
      );
    });
    return rows.filter((r) => r.postureFilter !== "healthy");
  }, [systems, incidents, changes]);

  const categoryOptions = useMemo(() => {
    const fromData = [...new Set(modelRows.map((r) => r.category))];
    const merged = [...new Set([...CATEGORY_PRESET, ...fromData])];
    return merged.sort((a, b) => a.localeCompare(b));
  }, [modelRows]);

  const filteredRows = useMemo(() => {
    return modelRows.filter((r) => {
      if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
      if (postureFilter !== "all" && r.postureFilter !== postureFilter) return false;
      return true;
    });
  }, [modelRows, categoryFilter, postureFilter]);

  useEffect(() => {
    if (!filteredRows.length) {
      setSelectedSystemId(null);
      return;
    }
    const existing = filteredRows.find((r) => r.system.id === selectedSystemId);
    if (!existing) setSelectedSystemId(filteredRows[0].system.id);
  }, [filteredRows, selectedSystemId]);

  const selected = filteredRows.find((r) => r.system.id === selectedSystemId) ?? null;
  const atRiskCount = modelRows.length;

  const selectedIncidentRows = useMemo(() => {
    if (!selected) return [];
    return selected.allIncidents
      .slice()
      .sort((a, b) => {
        const sev = severityRank(b.severity) - severityRank(a.severity);
        if (sev !== 0) return sev;
        const sr = statusRank(b) - statusRank(a);
        if (sr !== 0) return sr;
        return (toTs(a.created_at) ?? 0) - (toTs(b.created_at) ?? 0);
      });
  }, [selected]);

  const recurringCountByRule = useMemo(() => {
    const map = new Map<string, number>();
    if (!selected) return map;
    for (const incident of selected.allIncidents) {
      const key = String(incident.rule_id ?? "");
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [selected]);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
      <Card className="flex h-[min(55vh,28rem)] flex-col overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-bold text-slate-900">
            Model(s) at Risk:{" "}
            <span className="tabular-nums text-rose-700">{formatInteger(atRiskCount)}</span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="all">All categories</option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Select
              value={postureFilter}
              onChange={(e) =>
                setPostureFilter(e.target.value as Exclude<PostureFilter, "healthy">)
              }
            >
              <option value="all">All postures</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="watchlist">Watchlist</option>
            </Select>
            <p className="ml-auto text-[11px] text-slate-500">
              Showing <span className="font-semibold text-slate-700">{formatInteger(filteredRows.length)}</span>{" "}
              of {formatInteger(modelRows.length)} Systems
            </p>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <table className="w-full table-fixed text-[11px]">
            <colgroup>
              <col className="w-[28%]" />
              <col className="w-[26%]" />
              <col className="w-[12%]" />
              <col className="w-[8%]" />
              <col className="w-[8%]" />
              <col className="w-[8%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 text-slate-500 backdrop-blur">
              <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-semibold">
                <th>Systems</th>
                <th>Category</th>
                <th>Status</th>
                <th className="text-right">
                  <span className="inline-flex items-center justify-end gap-1">
                    Open
                    <InfoTooltip
                      ariaLabel="Open incidents info"
                      content="Current unresolved incidents for the system."
                      className="h-4 w-4"
                    />
                  </span>
                </th>
                <th className="text-right">
                  <span className="inline-flex items-center justify-end gap-1">
                    Critical
                    <InfoTooltip
                      ariaLabel="Critical incidents info"
                      content="Open incidents currently at critical or high severity."
                      className="h-4 w-4"
                    />
                  </span>
                </th>
                <th>
                  <span className="inline-flex items-center gap-1">
                    Last
                    <InfoTooltip
                      ariaLabel="Last open issue info"
                      content="Age of the oldest unresolved issue in this system."
                      className="h-4 w-4"
                    />
                  </span>
                </th>
                <th className="text-right">
                  <span className="inline-flex items-center justify-end gap-1">
                    30d
                    <InfoTooltip
                      ariaLabel="30 day open solved info"
                      content="Open/Solved in last 30 days. Left number is incidents opened (red), right number is fixes/closures (green)."
                      className="h-4 w-4"
                    />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((row) => {
                const selectedRow = selected?.system.id === row.system.id;
                const systemName = row.system.use_case || row.system.name || row.system.id;
                return (
                  <tr
                    key={row.system.id}
                    onClick={() => setSelectedSystemId(row.system.id)}
                    className={cn(
                      "cursor-pointer transition hover:bg-slate-50/80",
                      selectedRow && "bg-indigo-100/70 shadow-[inset_0_0_0_1px_rgba(67,56,202,0.22)]"
                    )}
                  >
                    <td className={cn("px-3 py-2.5", selectedRow && "border-l-2 border-l-indigo-500")}>
                      <p
                        className={cn(
                          "truncate font-medium",
                          selectedRow ? "text-indigo-900 font-semibold" : "text-slate-900"
                        )}
                      >
                        {systemName}
                      </p>
                      <p className={cn("truncate text-[10px]", selectedRow ? "text-indigo-700" : "text-slate-500")}>
                        {row.system.model ?? row.system.id}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">
                      <span className="line-clamp-2 leading-snug">{row.category}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={statusTextClass(row.postureFilter)}>{row.postureLabel}</span>
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums font-semibold text-slate-900">
                      {formatInteger(row.openCount)}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums font-semibold text-slate-900">
                      {formatInteger(row.criticalHighCount)}
                    </td>
                    <td className="px-2 py-2.5 text-slate-700">
                      {row.oldestOpenTs ? (
                        <span className="tabular-nums">{daysAgo(row.oldestOpenTs)}d</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">
                      <span className="font-semibold text-rose-700">{formatInteger(row.issues30d)}</span>
                      <span className="mx-0.5 text-slate-400">/</span>
                      <span className="font-semibold text-emerald-700">
                        {formatInteger(row.fixes30d)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="flex h-[min(55vh,28rem)] flex-col overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          {selected ? (
            <div className="space-y-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <p className="truncate text-[13px] font-semibold text-indigo-950">
                    {selected.system.use_case || selected.system.name || selected.system.id}
                  </p>
                  <span className={statusTextClass(selected.postureFilter)}>
                    {selected.postureLabel}
                  </span>
                </div>
                <details className="group relative shrink-0">
                  <summary className="flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900 [&::-webkit-details-marker]:hidden">
                    <MoreHorizontal className="h-4 w-4" />
                  </summary>
                  <div className="absolute right-0 top-8 z-20 min-w-[11rem] rounded-md border border-slate-200 bg-white p-1 shadow-lg">
                    <Link
                      href={withAiScope(routeToSystem(selected.system.id), scope)}
                      className="block rounded px-2 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    >
                      Open model
                    </Link>
                    <Link
                      href={withAiScope(routeToIncidentsForSystem(selected.system.id), scope)}
                      className="block rounded px-2 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    >
                      View related incidents
                    </Link>
                  </div>
                </details>
              </div>
              <p className="text-[11px] text-slate-600">
                {selected.owner}
                <span className="mx-1 text-slate-300">·</span>
                {selected.category}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="rounded border border-slate-200 bg-white px-2 py-0.5 text-slate-700">
                  Open <span className="tabular-nums font-semibold text-slate-900">{formatInteger(selected.openCount)}</span>
                </span>
                <span className="rounded border border-slate-200 bg-white px-2 py-0.5 text-slate-700">
                  Oldest{" "}
                  <span className="tabular-nums font-semibold text-slate-900">
                    {selected.oldestOpenTs ? `${daysAgo(selected.oldestOpenTs)}d` : "—"}
                  </span>
                </span>
                <span className="rounded border border-slate-200 bg-white px-2 py-0.5 text-slate-700">
                  30d{" "}
                  <span className="tabular-nums font-semibold text-rose-700">
                    {formatInteger(selected.issues30d)}
                  </span>
                  <span className="mx-0.5 text-slate-400">/</span>
                  <span className="tabular-nums font-semibold text-emerald-700">
                    {formatInteger(selected.fixes30d)}
                  </span>
                </span>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-[11px] text-slate-500">No model selected.</p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2">
          {!selected ? (
            <p className="py-4 text-sm text-slate-500">
              No systems match the current filters.
            </p>
          ) : selectedIncidentRows.length === 0 || selected.allIncidents.length === 0 ? (
            <p className="py-4 text-sm text-slate-500">
              No open incidents for this model. Recent fixes and measured outcomes are available in
              Outcomes.
            </p>
          ) : (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Incidents
              </p>
              <ul className="space-y-1.5">
                {selectedIncidentRows.slice(0, 12).map((incident: any) => (
                  <li key={incident.id}>
                    <Link
                      href={appendReturnTo(
                        routeToIncident(incident.id),
                        withAiScope(routes.dashboard(), scope)
                      )}
                      className="group block rounded-md border border-slate-200 bg-white px-2.5 py-2 transition hover:border-slate-300 hover:bg-slate-50/70 hover:shadow-sm"
                    >
                      <p className="truncate text-[12px] font-medium text-slate-900 group-hover:text-slate-950">
                        {incident.title}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-700 ring-1 ring-slate-200">
                          {incidentStatusTag(incident)}
                        </span>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 font-semibold ring-1",
                            incident.severity === "critical" || incident.severity === "high"
                              ? "bg-rose-100 text-rose-800 ring-rose-200"
                              : incident.severity === "medium"
                                ? "bg-amber-100 text-amber-800 ring-amber-200"
                                : "bg-emerald-100 text-emerald-800 ring-emerald-200"
                          )}
                        >
                          {humanizeLabel(incident.severity)}
                        </span>
                        {incident.escalation_status === "escalated" ? (
                          <span className="rounded bg-rose-100 px-1.5 py-0.5 font-semibold text-rose-800 ring-1 ring-rose-200">
                            Escalated
                          </span>
                        ) : null}
                        {incident.review_required ? (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800 ring-1 ring-amber-200">
                            Review required
                          </span>
                        ) : null}
                        {(recurringCountByRule.get(String(incident.rule_id ?? "")) ?? 0) >= 2 ? (
                          <span className="rounded bg-violet-100 px-1.5 py-0.5 font-semibold text-violet-800 ring-1 ring-violet-200">
                            Recurring
                          </span>
                        ) : null}
                        {isNewIncident(incident) ? (
                          <span className="rounded bg-sky-100 px-1.5 py-0.5 font-semibold text-sky-800 ring-1 ring-sky-200">
                            New
                          </span>
                        ) : null}
                        <span className="rounded bg-white/80 px-1.5 py-0.5 font-medium text-slate-700 ring-1 ring-slate-200">
                          {incidentRecencyLabel(incident)}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
