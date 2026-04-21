"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { readDemoState } from "@/lib/demo-state";
import { humanizeLabel, severityBadgeClasses } from "@/lib/present";

type Props = {
  incidents: any[];
};

export function IncidentQueueTable({ incidents }: Props) {
  const [severityFilter, setSeverityFilter] = useState("all");
  const [riskCategoryFilter, setRiskCategoryFilter] = useState("all");
  const [ownerTeamFilter, setOwnerTeamFilter] = useState("all");
  const [lifecycleFilter, setLifecycleFilter] = useState("all");

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

  const filtered = useMemo(
    () =>
      overlaid.filter((incident) => {
        if (severityFilter !== "all" && incident.severity !== severityFilter) return false;
        if (riskCategoryFilter !== "all" && incident.risk_category !== riskCategoryFilter) return false;
        if (ownerTeamFilter !== "all" && incident.owner_team !== ownerTeamFilter) return false;
        if (lifecycleFilter !== "all" && incident.incident_status !== lifecycleFilter) return false;
        return true;
      }),
    [overlaid, severityFilter, riskCategoryFilter, ownerTeamFilter, lifecycleFilter]
  );

  const summary = useMemo(() => {
    const high = filtered.filter((i) => i.severity === "high").length;
    const escalated = filtered.filter(
      (i) => i.escalation_status === "escalated" || i.incident_status === "escalated"
    ).length;
    return `${filtered.length} incidents · ${high} high · ${escalated} escalated`;
  }, [filtered]);

  const riskCategories = [...new Set(overlaid.map((i) => i.risk_category))].sort();
  const ownerTeams = [...new Set(overlaid.map((i) => i.owner_team))].sort();
  const lifecycles = [...new Set(overlaid.map((i) => i.incident_status))].sort();

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border bg-white p-3">
        <p className="text-sm font-medium text-slate-700">{summary}</p>
        <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="rounded border px-2 py-1">
            <option value="all">All Severities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select value={riskCategoryFilter} onChange={(e) => setRiskCategoryFilter(e.target.value)} className="rounded border px-2 py-1">
            <option value="all">All Risk Categories</option>
            {riskCategories.map((item) => (
              <option key={item} value={item}>
                {humanizeLabel(item)}
              </option>
            ))}
          </select>
          <select value={ownerTeamFilter} onChange={(e) => setOwnerTeamFilter(e.target.value)} className="rounded border px-2 py-1">
            <option value="all">All Owner Teams</option>
            {ownerTeams.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select value={lifecycleFilter} onChange={(e) => setLifecycleFilter(e.target.value)} className="rounded border px-2 py-1">
            <option value="all">All Lifecycles</option>
            {lifecycles.map((item) => (
              <option key={item} value={item}>
                {humanizeLabel(item)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Incident</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Risk Category</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">System</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Owner Team</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Severity</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Lifecycle</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Escalation</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Action Preview</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Triggered</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((incident) => (
              <tr key={incident.id}>
                <td className="px-4 py-3">
                  <Link href={`/incidents/${incident.id}`} className="font-medium hover:underline">
                    {incident.title}
                  </Link>
                </td>
                <td className="px-4 py-3">{humanizeLabel(incident.risk_category)}</td>
                <td className="px-4 py-3">
                  <p>{incident.system_name}</p>
                  <p className="text-xs text-slate-500">{incident.system_id}</p>
                </td>
                <td className="px-4 py-3">{incident.owner_team}</td>
                <td className="px-4 py-3">
                  <span className={`rounded px-2 py-1 text-xs font-semibold ${severityBadgeClasses(incident.severity)}`}>
                    {humanizeLabel(incident.severity)}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium">{humanizeLabel(incident.incident_status)}</td>
                <td className="px-4 py-3">{humanizeLabel(incident.escalation_status)}</td>
                <td className="max-w-56 truncate px-4 py-3" title={incident.recommended_action}>
                  {incident.recommended_action}
                </td>
                <td className="px-4 py-3 text-slate-600">{incident.created_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
