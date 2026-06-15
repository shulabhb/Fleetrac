"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Select } from "@/components/ui/select";
import type { GovernanceSystemDTO } from "@/lib/governance-api";
import { routeToSystem, routes } from "@/lib/routes";
import { cn } from "@/lib/cn";

type Props = {
  systems: GovernanceSystemDTO[];
};

type SortKey = "open" | "recent" | "name";

export function SystemsFleetView({ systems }: Props) {
  const [owner, setOwner] = useState("all");
  const [platform, setPlatform] = useState("all");
  const [archetype, setArchetype] = useState("all");
  const [hasOpen, setHasOpen] = useState("all");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("open");

  const owners = useMemo(
    () => Array.from(new Set(systems.map((s) => s.owner_team))).sort(),
    [systems]
  );
  const platforms = useMemo(
    () => Array.from(new Set(systems.map((s) => s.platform))).sort(),
    [systems]
  );
  const archetypes = useMemo(
    () => Array.from(new Set(systems.map((s) => s.archetype))).sort(),
    [systems]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return systems
      .filter((s) => {
        if (owner !== "all" && s.owner_team !== owner) return false;
        if (platform !== "all" && s.platform !== platform) return false;
        if (archetype !== "all" && s.archetype !== archetype) return false;
        if (hasOpen === "yes" && s.open_incidents === 0) return false;
        if (hasOpen === "no" && s.open_incidents > 0) return false;
        if (q) {
          const hay = [s.system_id, s.display_system_id, s.system_name, s.system_name_alias ?? ""]
            .join(" ")
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortKey === "open") return b.open_incidents - a.open_incidents;
        if (sortKey === "recent") {
          const at = a.last_signal_at ? new Date(a.last_signal_at).getTime() : 0;
          const bt = b.last_signal_at ? new Date(b.last_signal_at).getTime() : 0;
          return bt - at;
        }
        return (a.system_name_alias ?? a.system_name).localeCompare(
          b.system_name_alias ?? b.system_name
        );
      });
  }, [systems, owner, platform, archetype, hasOpen, query, sortKey]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search systems…"
            className="w-full rounded-md border border-slate-200 py-1.5 pl-8 pr-2 text-[12px]"
          />
        </div>
        <Select value={owner} onChange={(e) => setOwner(e.target.value)}>
          <option value="all">All owners</option>
          {owners.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
        <Select value={platform} onChange={(e) => setPlatform(e.target.value)}>
          <option value="all">All platforms</option>
          {platforms.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
        <Select value={archetype} onChange={(e) => setArchetype(e.target.value)}>
          <option value="all">All archetypes</option>
          {archetypes.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
        <Select value={hasOpen} onChange={(e) => setHasOpen(e.target.value)}>
          <option value="all">Any incidents</option>
          <option value="yes">Has open incidents</option>
          <option value="no">No open incidents</option>
        </Select>
        <Select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
          <option value="open">Sort: open incidents</option>
          <option value="recent">Sort: recent signal</option>
          <option value="name">Sort: name</option>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 px-4 py-12 text-center text-[13px] text-slate-600">
          No systems match filters. Start the simulator to ingest telemetry.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((sys) => (
            <li key={sys.system_id}>
              <Link
                href={routeToSystem(sys.system_id)}
                className={cn(
                  "block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {sys.display_system_id} · {sys.archetype}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {sys.system_name_alias ?? sys.system_name}
                    </p>
                  </div>
                  {sys.open_incidents > 0 ? (
                    <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-800">
                      {sys.open_incidents} open
                    </span>
                  ) : (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                      Healthy
                    </span>
                  )}
                </div>
                <p className="mt-2 text-[11px] text-slate-600">
                  {sys.owner_team} · {sys.platform}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Last signal:{" "}
                  {sys.last_signal_at
                    ? new Date(sys.last_signal_at).toLocaleString()
                    : "No telemetry yet"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
