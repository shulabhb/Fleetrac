"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ChevronRight, Flag, Search } from "lucide-react";
import { readDemoState } from "@/lib/demo-state";
import { AnalyzeWithBob } from "@/components/bob/analyze-with-bob";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  humanizeLabel,
  lifecycleBadgeClasses,
  severityBadgeClasses,
  severityRank
} from "@/lib/present";
import { formatRelativeTime } from "@/lib/format";
import {
  appendReturnTo,
  routes,
  routeToIncident,
  routeToSystem
} from "@/lib/routes";

type Props = {
  incidents: any[];
};

export function IncidentQueueTable({ incidents }: Props) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const systemScope = params?.get("system") ?? null;
  const [severityFilter, setSeverityFilter] = useState(
    params?.get("severity") ?? "all"
  );
  const [riskCategoryFilter, setRiskCategoryFilter] = useState(
    params?.get("risk") ?? "all"
  );
  const [ownerTeamFilter, setOwnerTeamFilter] = useState(
    params?.get("owner") ?? "all"
  );
  const [lifecycleFilter, setLifecycleFilter] = useState("open");
  const [query, setQuery] = useState(params?.get("q") ?? "");
  const deferredQuery = useDeferredValue(query);

  const overlaid = useMemo(() => {
    const state = readDemoState();
    return incidents.map((incident) => {
      const patch = state[incident.id];
      if (!patch) return incident;
      return {
        ...incident,
        incident_status: patch.incidentStatus,
        escalation_status: patch.escalationStatus,
        review_required: patch.reviewRequired
      };
    });
  }, [incidents]);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return overlaid
      .filter((incident) => {
        if (systemScope && incident.system_id !== systemScope) return false;
        if (severityFilter !== "all" && incident.severity !== severityFilter) return false;
        if (riskCategoryFilter !== "all" && incident.risk_category !== riskCategoryFilter) return false;
        if (ownerTeamFilter !== "all" && incident.owner_team !== ownerTeamFilter) return false;
        if (lifecycleFilter === "open" && incident.incident_status === "closed") return false;
        else if (
          lifecycleFilter !== "all" &&
          lifecycleFilter !== "open" &&
          incident.incident_status !== lifecycleFilter
        )
          return false;
        if (q) {
          const haystack = [
            incident.title,
            incident.system_name,
            incident.system_id,
            incident.owner_team,
            incident.trigger_reason
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const escA = a.incident_status === "escalated" || a.escalation_status === "escalated" ? 1 : 0;
        const escB = b.incident_status === "escalated" || b.escalation_status === "escalated" ? 1 : 0;
        if (escB !== escA) return escB - escA;
        const sev = severityRank(b.severity) - severityRank(a.severity);
        if (sev !== 0) return sev;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [
    overlaid,
    systemScope,
    severityFilter,
    riskCategoryFilter,
    ownerTeamFilter,
    lifecycleFilter,
    deferredQuery
  ]);

  useEffect(() => {
    const next = new URLSearchParams(params?.toString() ?? "");
    if (severityFilter === "all") next.delete("severity");
    else next.set("severity", severityFilter);
    if (riskCategoryFilter === "all") next.delete("risk");
    else next.set("risk", riskCategoryFilter);
    if (ownerTeamFilter === "all") next.delete("owner");
    else next.set("owner", ownerTeamFilter);
    if (lifecycleFilter === "open") next.delete("lifecycle");
    else next.set("lifecycle", lifecycleFilter);
    if (query.trim()) next.set("q", query.trim());
    else next.delete("q");

    const current = params?.toString() ?? "";
    const target = next.toString();
    if (target !== current) {
      router.replace(target ? `${pathname}?${target}` : pathname, {
        scroll: false
      });
    }
  }, [
    params,
    pathname,
    router,
    severityFilter,
    riskCategoryFilter,
    ownerTeamFilter,
    lifecycleFilter,
    query
  ]);

  const returnTo = params?.toString() ? `${pathname}?${params.toString()}` : pathname;

  const counts = useMemo(() => {
    const high = filtered.filter((i) => i.severity === "high").length;
    const escalated = filtered.filter(
      (i) => i.escalation_status === "escalated" || i.incident_status === "escalated"
    ).length;
    const reviews = filtered.filter(
      (i) => i.review_required && ["detected", "under_review"].includes(i.incident_status)
    ).length;
    return { total: filtered.length, high, escalated, reviews };
  }, [filtered]);

  const riskCategories = [...new Set(overlaid.map((i) => i.risk_category))].sort();
  const ownerTeams = [...new Set(overlaid.map((i) => i.owner_team))].sort();
  const lifecycles = [...new Set(overlaid.map((i) => i.incident_status))].sort();

  const scopedSystemName = systemScope
    ? (overlaid.find((i) => i.system_id === systemScope)?.system_name ?? systemScope)
    : null;

  return (
    <div className="space-y-3">
      {scopedSystemName ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50/70 px-3 py-2 text-[11px] text-slate-600">
          <span>
            Scoped to system ·{" "}
            <span className="font-medium text-slate-800">
              {scopedSystemName}
            </span>
          </span>
          <div className="flex items-center gap-3">
            <Link
              href={routeToSystem(systemScope!)}
              className="font-medium text-slate-700 hover:text-slate-900"
            >
              Open system →
            </Link>
            <Link
              href={routes.incidents()}
              className="font-medium text-slate-500 hover:text-slate-900"
            >
              Clear scope
            </Link>
          </div>
        </div>
      ) : null}
      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search incidents, systems, owners…"
              className="h-8 w-full rounded-md border border-slate-200 bg-white pl-7 pr-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
            />
          </div>
          <Select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
            <option value="all">All severities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>
          <Select
            value={riskCategoryFilter}
            onChange={(e) => setRiskCategoryFilter(e.target.value)}
          >
            <option value="all">All risk categories</option>
            {riskCategories.map((item) => (
              <option key={item} value={item}>
                {humanizeLabel(item)}
              </option>
            ))}
          </Select>
          <Select value={ownerTeamFilter} onChange={(e) => setOwnerTeamFilter(e.target.value)}>
            <option value="all">All owner teams</option>
            {ownerTeams.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
          <Select value={lifecycleFilter} onChange={(e) => setLifecycleFilter(e.target.value)}>
            <option value="open">Open (not closed)</option>
            <option value="all">All lifecycles</option>
            {lifecycles.map((item) => (
              <option key={item} value={item}>
                {humanizeLabel(item)}
              </option>
            ))}
          </Select>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
          <span>
            <span className="font-semibold tabular-nums text-slate-900">{counts.total}</span>{" "}
            incidents
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            {counts.high} high
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {counts.reviews} awaiting review
          </span>
          <span className="inline-flex items-center gap-1">
            <Flag className="h-3 w-3 text-rose-600" />
            {counts.escalated} escalated
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr className="text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2 text-left font-medium">Incident</th>
              <th className="px-4 py-2 text-left font-medium">System</th>
              <th className="px-4 py-2 text-left font-medium">Risk</th>
              <th className="px-4 py-2 text-left font-medium">Owner</th>
              <th className="px-4 py-2 text-left font-medium">Severity</th>
              <th className="px-4 py-2 text-left font-medium">Lifecycle</th>
              <th className="px-4 py-2 text-left font-medium">Next action</th>
              <th className="px-4 py-2 text-left font-medium">Bob</th>
              <th className="px-4 py-2 text-right font-medium">Age</th>
              <th className="w-8 px-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((incident) => {
              const escalated =
                incident.escalation_status === "escalated" ||
                incident.incident_status === "escalated";
              return (
                <tr
                  key={incident.id}
                  className="group cursor-pointer transition hover:bg-slate-50"
                >
                  <td className="max-w-xs px-4 py-2.5">
                    <Link
                      href={appendReturnTo(routeToIncident(incident.id), returnTo)}
                      className="block truncate font-medium text-slate-900 hover:underline"
                    >
                      {incident.title}
                    </Link>
                    {escalated ? (
                      <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-medium text-rose-700">
                        <Flag className="h-3 w-3" />
                        Escalated
                      </span>
                    ) : incident.review_required ? (
                      <span className="mt-0.5 text-[10px] font-medium text-amber-700">
                        Review required
                      </span>
                    ) : null}
                  </td>
                  <td className="max-w-[14rem] px-4 py-2.5">
                    <Link
                      href={routeToSystem(incident.system_id)}
                      className="truncate font-medium text-slate-800 hover:underline"
                    >
                      {incident.system_name}
                    </Link>
                    <p className="truncate text-[11px] text-slate-500">{incident.system_id}</p>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-700">
                    {humanizeLabel(incident.risk_category)}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-700">{incident.owner_team}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${severityBadgeClasses(incident.severity)}`}
                    >
                      {humanizeLabel(incident.severity)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${lifecycleBadgeClasses(incident.incident_status)}`}
                    >
                      {humanizeLabel(incident.incident_status)}
                    </span>
                  </td>
                  <td
                    className="max-w-[18rem] truncate px-4 py-2.5 text-xs text-slate-700"
                    title={incident.recommended_action}
                  >
                    {incident.recommended_action}
                  </td>
                  <td className="px-4 py-2.5">
                    <AnalyzeWithBob
                      targetType="incident"
                      targetId={incident.id}
                      hasInvestigation
                      label="View Bob"
                    />
                  </td>
                  <td className="px-4 py-2.5 text-right text-[11px] tabular-nums text-slate-500">
                    {formatRelativeTime(incident.created_at)}
                  </td>
                  <td className="px-2 py-2.5 text-slate-300 group-hover:text-slate-600">
                    <ChevronRight className="h-4 w-4" />
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-sm text-slate-500">
                  No incidents match these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
