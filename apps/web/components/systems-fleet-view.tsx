"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Select } from "@/components/ui/select";
import { SystemCard } from "@/components/system-card";
import { humanizeLabel, postureRank, severityRank } from "@/lib/present";
import { cn } from "@/lib/cn";

type Props = {
  systems: any[];
  incidents: any[];
};

type SortKey =
  | "posture"
  | "severity"
  | "openCount"
  | "alphabetical"
  | "recent";

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: "severity", label: "Highest severity" },
  { id: "openCount", label: "Most open incidents" },
  { id: "posture", label: "Posture severity" },
  { id: "recent", label: "Recently active" },
  { id: "alphabetical", label: "A → Z" }
];

export function SystemsFleetView({ systems, incidents }: Props) {
  const [posture, setPosture] = useState("all");
  const [owner, setOwner] = useState("all");
  const [regulatorySensitivity, setRegulatorySensitivity] = useState("all");
  const [businessFunction, setBusinessFunction] = useState("all");
  const [hasOpenIncidents, setHasOpenIncidents] = useState("all");
  const [deploymentScope, setDeploymentScope] = useState("all");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("severity");

  const incidentsBySystem = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const incident of incidents) {
      (map[incident.system_id] ??= []).push(incident);
    }
    return map;
  }, [incidents]);

  const enriched = useMemo(() => {
    return systems.map((system) => {
      const all = incidentsBySystem[system.id] ?? [];
      const open = all.filter((i) => i.incident_status !== "closed");
      const highestSeverity = ["high", "medium", "low"].find((s) =>
        open.some((i) => i.severity === s)
      ) as "high" | "medium" | "low" | undefined;
      const topIssue = open[0];
      const lastActivity = all
        .map((i) => new Date(i.created_at).getTime())
        .sort((a, b) => b - a)[0];
      return { system, all, open, highestSeverity, topIssue, lastActivity };
    });
  }, [systems, incidentsBySystem]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enriched.filter(({ system, open }) => {
      if (posture !== "all" && system.risk_posture !== posture) return false;
      if (owner !== "all" && system.owner !== owner) return false;
      if (regulatorySensitivity !== "all" && system.regulatory_sensitivity !== regulatorySensitivity)
        return false;
      if (businessFunction !== "all" && system.business_function !== businessFunction) return false;
      if (deploymentScope !== "all" && system.deployment_scope !== deploymentScope) return false;
      if (hasOpenIncidents === "yes" && open.length === 0) return false;
      if (hasOpenIncidents === "no" && open.length > 0) return false;
      if (q) {
        const haystack = [
          system.id,
          system.name,
          system.use_case,
          system.model,
          system.owner,
          system.business_function
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [
    enriched,
    posture,
    owner,
    regulatorySensitivity,
    businessFunction,
    hasOpenIncidents,
    deploymentScope,
    query
  ]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      switch (sortKey) {
        case "alphabetical":
          return (a.system.use_case ?? a.system.name ?? "").localeCompare(
            b.system.use_case ?? b.system.name ?? ""
          );
        case "openCount":
          return b.open.length - a.open.length;
        case "posture":
          return (
            postureRank(b.system.risk_posture) - postureRank(a.system.risk_posture) ||
            b.open.length - a.open.length
          );
        case "recent":
          return (b.lastActivity ?? 0) - (a.lastActivity ?? 0);
        case "severity":
        default:
          return (
            severityRank(b.highestSeverity ?? "") - severityRank(a.highestSeverity ?? "") ||
            b.open.length - a.open.length ||
            postureRank(b.system.risk_posture) - postureRank(a.system.risk_posture)
          );
      }
    });
    return list;
  }, [filtered, sortKey]);

  const owners = useMemo(() => [...new Set(systems.map((s) => s.owner))].sort(), [systems]);
  const sensitivities = useMemo(
    () => [...new Set(systems.map((s) => s.regulatory_sensitivity))].sort(),
    [systems]
  );
  const businessFunctions = useMemo(
    () => [...new Set(systems.map((s) => s.business_function))].sort(),
    [systems]
  );
  const scopes = useMemo(
    () => [...new Set(systems.map((s) => s.deployment_scope))].sort(),
    [systems]
  );

  const counts = useMemo(() => {
    const postures = enriched.reduce(
      (acc: Record<string, number>, { system }) => {
        acc[system.risk_posture] = (acc[system.risk_posture] ?? 0) + 1;
        return acc;
      },
      { healthy: 0, watch: 0, at_risk: 0, critical: 0 }
    );
    return postures;
  }, [enriched]);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search systems, models, owners…"
              className="h-8 w-full rounded-md border border-slate-200 bg-white pl-7 pr-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
            />
          </div>
          <Select value={posture} onChange={(e) => setPosture(e.target.value)}>
            <option value="all">All postures</option>
            <option value="critical">Critical</option>
            <option value="at_risk">At risk</option>
            <option value="watch">Watch</option>
            <option value="healthy">Healthy</option>
          </Select>
          <Select value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="all">All owners</option>
            {owners.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </Select>
          <Select value={businessFunction} onChange={(e) => setBusinessFunction(e.target.value)}>
            <option value="all">All functions</option>
            {businessFunctions.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </Select>
          <Select
            value={regulatorySensitivity}
            onChange={(e) => setRegulatorySensitivity(e.target.value)}
          >
            <option value="all">All sensitivities</option>
            {sensitivities.map((o) => (
              <option key={o} value={o}>
                {humanizeLabel(o)}
              </option>
            ))}
          </Select>
          <Select value={deploymentScope} onChange={(e) => setDeploymentScope(e.target.value)}>
            <option value="all">Any scope</option>
            {scopes.map((o) => (
              <option key={o} value={o}>
                {humanizeLabel(o)}
              </option>
            ))}
          </Select>
          <Select value={hasOpenIncidents} onChange={(e) => setHasOpenIncidents(e.target.value)}>
            <option value="all">Open incidents: any</option>
            <option value="yes">With open incidents</option>
            <option value="no">Without open incidents</option>
          </Select>
          <div className="ml-auto flex items-center gap-2">
            <label className="text-[11px] uppercase tracking-wide text-slate-400">Sort</label>
            <Select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="min-w-[160px]"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
          <span>
            <span className="font-semibold tabular-nums text-slate-900">{sorted.length}</span> of{" "}
            {systems.length} systems
          </span>
          <span className="inline-flex items-center gap-1">
            <Dot className="bg-red-500" />
            {counts.critical ?? 0} critical
          </span>
          <span className="inline-flex items-center gap-1">
            <Dot className="bg-rose-500" />
            {counts.at_risk ?? 0} at risk
          </span>
          <span className="inline-flex items-center gap-1">
            <Dot className="bg-amber-500" />
            {counts.watch ?? 0} watch
          </span>
          <span className="inline-flex items-center gap-1">
            <Dot className="bg-emerald-500" />
            {counts.healthy ?? 0} healthy
          </span>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          No systems match the current filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map(({ system, open, highestSeverity, topIssue }) => (
            <SystemCard
              key={system.id}
              system={system}
              openCount={open.length}
              highestSeverity={highestSeverity}
              topIssueTitle={topIssue?.title ?? null}
              compact
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Dot({ className }: { className: string }) {
  return <span className={cn("inline-block h-1.5 w-1.5 rounded-full", className)} />;
}
