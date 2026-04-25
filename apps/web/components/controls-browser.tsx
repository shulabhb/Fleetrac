"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ChevronRight, LayoutGrid, List, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { formatInteger, formatRelativeTime } from "@/lib/format";
import {
  humanizeLabel,
  riskDomainFromCategory,
  severityBadgeClasses,
  severityRank,
  signalColor,
  signalTypeForField
} from "@/lib/present";
import { BobIcon } from "@/components/bob/bob-icon";
import {
  appendReturnTo,
  routeToBobInvestigation,
  routeToControl,
  routeToIncidentsForControl
} from "@/lib/routes";

type Props = {
  rules: any[];
  incidents: any[];
  bobControlReviews?: any[];
};

type ViewMode = "compact" | "cards";

type SortKey =
  | "priority"
  | "recent"
  | "total"
  | "last"
  | "systems"
  | "severity"
  | "name";

type Bucket = "all" | "bob_flagged" | "active" | "recurring" | "quiet";

type EnrichedControl = {
  rule: any;
  triggered: any[];
  recentCount: number;
  systemsCovered: number;
  lastTriggered: string | undefined;
  ownerTeam: string;
  signal: string;
  risk: string;
  consequence: string;
  bob: any | null;
  isActive: boolean;
  isRecurring: boolean;
  isQuiet: boolean;
};

const VIEW_STORAGE_KEY = "fleetrac:controls:view";
const SORT_STORAGE_KEY = "fleetrac:controls:sort";

const SORT_LABELS: Record<SortKey, string> = {
  priority: "Priority (smart)",
  recent: "Most fires (7d)",
  total: "Most total fires",
  last: "Recently triggered",
  systems: "Systems covered",
  severity: "Severity",
  name: "Name (A→Z)"
};

/**
 * Governance Controls operator surface.
 *
 * Design intent: operator surface — buckets and counts first, dense rows,
 * actions only when a review or incident exists to open. Secondary filters
 * stay tucked behind a disclosure so the default chrome stays calm.
 */
export function ControlsBrowser({
  rules,
  incidents,
  bobControlReviews = []
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const listReturnTo = `${pathname ?? "/controls"}${
    searchParams?.toString() ? `?${searchParams.toString()}` : ""
  }`;
  const initialQuery = searchParams?.get("q") ?? "";

  const [view, setView] = useState<ViewMode>("compact");
  const [sortKey, setSortKey] = useState<SortKey>("priority");
  const [bucket, setBucket] = useState<Bucket>("all");
  const [severity, setSeverity] = useState("all");
  const [signalType, setSignalType] = useState("all");
  const [riskDomain, setRiskDomain] = useState("all");
  const [ownerTeam, setOwnerTeam] = useState("all");
  const [query, setQuery] = useState(initialQuery);
  const deferredQuery = useDeferredValue(query);

  // Persist operator preference locally so the view doesn't reset every load.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (v === "compact" || v === "cards") setView(v);
    const s = window.localStorage.getItem(SORT_STORAGE_KEY);
    if (s && s in SORT_LABELS) setSortKey(s as SortKey);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(VIEW_STORAGE_KEY, view);
    }
  }, [view]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SORT_STORAGE_KEY, sortKey);
    }
  }, [sortKey]);

  useEffect(() => {
    const q = searchParams?.get("q");
    if (q != null) setQuery(q);
  }, [searchParams]);

  const bobByControl = useMemo(() => {
    const map: Record<string, any> = {};
    for (const inv of bobControlReviews) {
      if (inv.target_id) map[inv.target_id] = inv;
    }
    return map;
  }, [bobControlReviews]);

  const enriched = useMemo<EnrichedControl[]>(() => {
    const now = Date.now();
    const within7d = 7 * 24 * 60 * 60 * 1000;
    const incidentsByRule: Record<string, any[]> = {};
    for (const inc of incidents) (incidentsByRule[inc.rule_id] ??= []).push(inc);
    return rules.map((rule: any) => {
      const triggered = (incidentsByRule[rule.id] ?? []).slice();
      // Ensure deterministic newest-first ordering of triggered incidents so
      // downstream "latest incident" links and relative-time fields are stable.
      triggered.sort(
        (a: any, b: any) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const systemsCovered = new Set(triggered.map((i: any) => i.system_id))
        .size;
      const recent = triggered.filter(
        (i: any) => now - new Date(i.created_at).getTime() <= within7d
      );
      const lastTriggered = triggered[0]?.created_at;
      const team = triggered[0]?.owner_team ?? "Governance Operations";
      const signal = signalTypeForField(rule.observed_field);
      const risk = riskDomainFromCategory(rule.category);
      const consequence =
        triggered[0]?.recommended_action ??
        "Review playbook and route to owning team.";
      const bob = bobByControl[rule.id] ?? null;
      const recentCount = recent.length;
      return {
        rule,
        triggered,
        recentCount,
        systemsCovered,
        lastTriggered,
        ownerTeam: team,
        signal,
        risk,
        consequence,
        bob,
        isActive: recentCount > 0,
        isRecurring: recentCount >= 3,
        isQuiet: recentCount === 0
      };
    });
  }, [rules, incidents, bobByControl]);

  const bucketCounts = useMemo(() => {
    let bobFlagged = 0;
    let active = 0;
    let recurring = 0;
    let quiet = 0;
    for (const c of enriched) {
      if (c.bob) bobFlagged += 1;
      if (c.isActive) active += 1;
      if (c.isRecurring) recurring += 1;
      if (c.isQuiet) quiet += 1;
    }
    return {
      all: enriched.length,
      bob_flagged: bobFlagged,
      active,
      recurring,
      quiet
    } as Record<Bucket, number>;
  }, [enriched]);

  const signalTypes = useMemo(
    () => [...new Set(enriched.map((e) => e.signal))].sort(),
    [enriched]
  );
  const riskDomains = useMemo(
    () => [...new Set(enriched.map((e) => e.risk))].sort(),
    [enriched]
  );
  const ownerTeams = useMemo(
    () => [...new Set(enriched.map((e) => e.ownerTeam))].sort(),
    [enriched]
  );

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const rows = enriched.filter((c) => {
      if (severity !== "all" && c.rule.severity !== severity) return false;
      if (signalType !== "all" && c.signal !== signalType) return false;
      if (riskDomain !== "all" && c.risk !== riskDomain) return false;
      if (ownerTeam !== "all" && c.ownerTeam !== ownerTeam) return false;
      if (bucket === "bob_flagged" && !c.bob) return false;
      if (bucket === "active" && !c.isActive) return false;
      if (bucket === "recurring" && !c.isRecurring) return false;
      if (bucket === "quiet" && !c.isQuiet) return false;
      if (q) {
        const hay = [
          c.rule.name,
          c.rule.description,
          c.rule.observed_field,
          c.rule.id
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    rows.sort((a, b) => compareControls(a, b, sortKey));
    return rows;
  }, [
    enriched,
    severity,
    signalType,
    riskDomain,
    ownerTeam,
    bucket,
    deferredQuery,
    sortKey
  ]);

  const totalRecent = filtered.reduce((acc, c) => acc + c.recentCount, 0);

  return (
    <div className="space-y-3">
      {/* Summary buckets — operator-first filter presets */}
      <BucketStrip
        counts={bucketCounts}
        active={bucket}
        onChange={setBucket}
      />

      {/* Search, sort, view — refinements behind disclosure */}
      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[min(100%,220px)] flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or rule id…"
              className="h-8 w-full rounded-md border border-slate-200 bg-white pl-7 pr-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
            />
          </div>
          <Select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            aria-label="Sort controls"
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {SORT_LABELS[k]}
              </option>
            ))}
          </Select>
          <ViewToggle view={view} onChange={setView} />
        </div>
        <details className="group/filters mt-2 border-t border-slate-100 pt-2">
          <summary className="cursor-pointer list-none text-[11px] font-medium text-slate-600 marker:content-none [&::-webkit-details-marker]:hidden hover:text-slate-900">
            <span className="inline-flex items-center gap-1">
              <ChevronRight className="h-3 w-3 shrink-0 transition group-open/filters:rotate-90" />
              Refine (severity, signal, risk, owner)
            </span>
          </summary>
          <div className="mt-2 flex flex-wrap gap-2">
            <Select value={severity} onChange={(e) => setSeverity(e.target.value)}>
              <option value="all">All severities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
            <Select value={signalType} onChange={(e) => setSignalType(e.target.value)}>
              <option value="all">All signals</option>
              {signalTypes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <Select value={riskDomain} onChange={(e) => setRiskDomain(e.target.value)}>
              <option value="all">All risk domains</option>
              {riskDomains.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
            <Select value={ownerTeam} onChange={(e) => setOwnerTeam(e.target.value)}>
              <option value="all">All owners</option>
              {ownerTeams.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          </div>
        </details>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
          <span className="tabular-nums text-slate-700">
            <span className="font-semibold text-slate-900">{filtered.length}</span>
            <span className="text-slate-400"> / {rules.length}</span>
            <span className="ml-1.5 text-slate-500">controls</span>
          </span>
          <span className="text-slate-400">·</span>
          <span>
            <span className="font-medium tabular-nums text-slate-800">
              {formatInteger(totalRecent)}
            </span>{" "}
            incidents (7d)
          </span>
          {bucket !== "all" ? (
            <>
              <span className="text-slate-400">·</span>
              <button
                type="button"
                onClick={() => setBucket("all")}
                className="font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
              >
                Reset bucket
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          No controls match the current filters.
        </div>
      ) : view === "compact" ? (
        <CompactList rows={filtered} listReturnTo={listReturnTo} />
      ) : (
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {filtered.map((c) => (
            <ControlCard key={c.rule.id} control={c} listReturnTo={listReturnTo} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

function compareControls(
  a: EnrichedControl,
  b: EnrichedControl,
  key: SortKey
): number {
  switch (key) {
    case "recent":
      return (
        b.recentCount - a.recentCount ||
        b.triggered.length - a.triggered.length ||
        severityRank(b.rule.severity) - severityRank(a.rule.severity)
      );
    case "total":
      return (
        b.triggered.length - a.triggered.length ||
        b.recentCount - a.recentCount
      );
    case "last":
      return (
        new Date(b.lastTriggered ?? 0).getTime() -
        new Date(a.lastTriggered ?? 0).getTime()
      );
    case "systems":
      return b.systemsCovered - a.systemsCovered;
    case "severity":
      return (
        severityRank(b.rule.severity) - severityRank(a.rule.severity) ||
        b.recentCount - a.recentCount
      );
    case "name":
      return a.rule.name.localeCompare(b.rule.name);
    case "priority":
    default:
      // Smart default: Bob-flagged first, then recent fires, then severity,
      // then total fires. Keeps the most operationally urgent rows on top.
      if (Boolean(b.bob) !== Boolean(a.bob)) return b.bob ? 1 : -1;
      if (b.recentCount !== a.recentCount) return b.recentCount - a.recentCount;
      const sev = severityRank(b.rule.severity) - severityRank(a.rule.severity);
      if (sev !== 0) return sev;
      return b.triggered.length - a.triggered.length;
  }
}

// ---------------------------------------------------------------------------
// Summary buckets
// ---------------------------------------------------------------------------

function BucketStrip({
  counts,
  active,
  onChange
}: {
  counts: Record<Bucket, number>;
  active: Bucket;
  onChange: (b: Bucket) => void;
}) {
  const items: Array<{
    id: Bucket;
    label: string;
    caption: string;
    tone: "neutral" | "indigo" | "rose" | "amber" | "emerald";
  }> = [
    {
      id: "all",
      label: "All controls",
      caption: "Full catalog",
      tone: "neutral"
    },
    {
      id: "bob_flagged",
      label: "Bob flagged",
      caption: "Review or tune",
      tone: "indigo"
    },
    {
      id: "active",
      label: "Active now",
      caption: "Fired in last 7d",
      tone: "rose"
    },
    {
      id: "recurring",
      label: "Recurring",
      caption: "≥3 fires in 7d",
      tone: "amber"
    },
    {
      id: "quiet",
      label: "Quiet",
      caption: "No recent fires",
      tone: "emerald"
    }
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((it) => {
        const isActive = active === it.id;
        const n = counts[it.id];
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onChange(isActive && it.id !== "all" ? "all" : it.id)}
            aria-pressed={isActive}
            className={cn(
              "group flex items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-left transition",
              isActive
                ? "border-slate-900 shadow-sm"
                : "border-slate-200 hover:border-slate-300"
            )}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    bucketDotClasses(it.tone)
                  )}
                />
                <span className="truncate text-[12px] font-semibold text-slate-900">
                  {it.label}
                </span>
              </div>
              <p className="mt-0.5 truncate text-[11px] text-slate-500">
                {it.caption}
              </p>
            </div>
            <span className="tabular-nums text-sm font-semibold text-slate-900">
              {formatInteger(n)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function bucketDotClasses(
  tone: "neutral" | "indigo" | "rose" | "amber" | "emerald"
): string {
  switch (tone) {
    case "indigo":
      return "bg-indigo-500";
    case "rose":
      return "bg-rose-500";
    case "amber":
      return "bg-amber-500";
    case "emerald":
      return "bg-emerald-500";
    case "neutral":
    default:
      return "bg-slate-400";
  }
}

// ---------------------------------------------------------------------------
// View toggle
// ---------------------------------------------------------------------------

function ViewToggle({
  view,
  onChange
}: {
  view: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div
      className="inline-flex items-center rounded-md border border-slate-200 bg-white p-0.5"
      role="tablist"
      aria-label="Controls view"
    >
      <ToggleButton
        active={view === "compact"}
        onClick={() => onChange("compact")}
        icon={<List className="h-3.5 w-3.5" />}
        label="Compact"
      />
      <ToggleButton
        active={view === "cards"}
        onClick={() => onChange("cards")}
        icon={<LayoutGrid className="h-3.5 w-3.5" />}
        label="Cards"
      />
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  icon,
  label
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-medium transition",
        active
          ? "bg-slate-900 text-white"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Compact list mode
// ---------------------------------------------------------------------------

function CompactList({
  rows,
  listReturnTo
}: {
  rows: EnrichedControl[];
  listReturnTo: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="hidden grid-cols-[minmax(0,1.35fr)_92px_92px_minmax(0,0.85fr)_48px_48px_48px_72px_minmax(132px,1fr)] items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-slate-500 md:grid">
        <span>Control</span>
        <span>Signal</span>
        <span>Risk</span>
        <span>Owner</span>
        <span className="text-right">Sys</span>
        <span className="text-right">7d</span>
        <span className="text-right">Tot</span>
        <span>Last</span>
        <span className="text-right">Actions</span>
      </div>
      <ul className="divide-y divide-slate-100">
        {rows.map((c) => (
          <CompactRow key={c.rule.id} control={c} listReturnTo={listReturnTo} />
        ))}
      </ul>
    </div>
  );
}

function CompactRow({
  control,
  listReturnTo
}: {
  control: EnrichedControl;
  listReturnTo: string;
}) {
  const {
    rule,
    triggered,
    recentCount,
    systemsCovered,
    lastTriggered,
    ownerTeam: team,
    signal,
    risk,
    bob
  } = control;
  const openIncidents = triggered.filter(
    (i: any) => i.incident_status !== "closed"
  ).length;
  const controlHref = appendReturnTo(routeToControl(rule.id), listReturnTo);

  return (
    <li className="grid grid-cols-1 items-center gap-2 px-3 py-2 text-[12px] transition hover:bg-slate-50/80 md:grid-cols-[minmax(0,1.35fr)_92px_92px_minmax(0,0.85fr)_48px_48px_48px_72px_minmax(132px,1fr)] md:gap-2">
      {/* Col 1 — Control identity */}
      <div
        className="min-w-0"
        title={[rule.description, bob?.summary].filter(Boolean).join("\n\n") || undefined}
      >
        <div className="flex min-w-0 items-center gap-2">
          <SeverityDot severity={rule.severity} />
          <Link
            href={controlHref}
            className="min-w-0 truncate font-semibold text-slate-900 hover:text-indigo-900 hover:underline"
          >
            {rule.name}
          </Link>
          {bob ? (
            <span
              className="inline-flex shrink-0 items-center gap-0.5 rounded bg-indigo-50 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-indigo-800 ring-1 ring-indigo-200/80"
              title={bob.summary}
            >
              <BobIcon size="xs" withBackground={false} />
              Bob
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate font-mono text-[10px] text-slate-400">{rule.id}</p>
      </div>

      {/* Col 2 — Signal */}
      <div className="md:block">
        <span
          className={cn(
            "inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-medium",
            signalColor(signal)
          )}
          title={`Signal type · ${signal}`}
        >
          {signal}
        </span>
      </div>

      {/* Col 3 — Risk */}
      <div className="md:block">
        <Badge tone="neutral" size="xs" className="max-w-full truncate">
          {risk}
        </Badge>
      </div>

      {/* Col 4 — Owner */}
      <div className="min-w-0 truncate text-[11px] text-slate-600" title={team}>
        {team}
      </div>

      {/* Col 5 — Systems */}
      <Number value={systemsCovered} />

      {/* Col 6 — 7d */}
      <Number value={recentCount} emphasize={recentCount > 0} />

      {/* Col 7 — Total */}
      <Number value={triggered.length} muted />

      {/* Col 8 — Last triggered */}
      <div
        className={cn(
          "truncate text-[11px]",
          lastTriggered ? "text-slate-600" : "text-slate-400"
        )}
      >
        {lastTriggered ? formatRelativeTime(lastTriggered) : "Quiet"}
      </div>

      {/* Col 9 — Control-first actions */}
      <div className="flex flex-col items-end justify-end gap-1.5 md:min-h-[44px]">
        <Link
          href={controlHref}
          className="inline-flex w-full items-center justify-center rounded border border-slate-900 bg-slate-900 px-2 py-0.5 text-center text-[11px] font-semibold text-white transition hover:bg-slate-800 md:w-auto md:min-w-[5.5rem]"
        >
          View control
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5">
          {openIncidents > 0 ? (
            <Link
              href={appendReturnTo(
                routeToIncidentsForControl(rule.id),
                listReturnTo
              )}
              className="text-[11px] font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
            >
              Open incidents ({formatInteger(openIncidents)})
            </Link>
          ) : triggered.length > 0 ? (
            <Link
              href={appendReturnTo(
                routeToIncidentsForControl(rule.id),
                listReturnTo
              )}
              className="text-[10px] font-medium text-slate-400 hover:text-slate-600"
            >
              Incident history
            </Link>
          ) : null}
          {bob ? (
            <Link
              href={appendReturnTo(routeToBobInvestigation(bob.id), listReturnTo)}
              className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-indigo-800 hover:text-indigo-950"
            >
              <BobIcon size="xs" withBackground={false} />
              Bob review
            </Link>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function Number({
  value,
  emphasize,
  muted
}: {
  value: number;
  emphasize?: boolean;
  muted?: boolean;
}) {
  return (
    <span
      className={cn(
        "text-right tabular-nums text-[12px] font-semibold",
        emphasize
          ? "text-rose-700"
          : muted
          ? "text-slate-500"
          : "text-slate-900"
      )}
    >
      {formatInteger(value)}
    </span>
  );
}

function SeverityDot({ severity }: { severity: string }) {
  const cls =
    severity === "high"
      ? "bg-rose-500"
      : severity === "medium"
      ? "bg-amber-500"
      : "bg-emerald-500";
  return (
    <span
      aria-label={`Severity ${severity}`}
      title={`Severity · ${humanizeLabel(severity)}`}
      className={cn("h-2 w-2 shrink-0 rounded-full", cls)}
    />
  );
}

// ---------------------------------------------------------------------------
// Card mode — denser than before
// ---------------------------------------------------------------------------

function ControlCard({
  control,
  listReturnTo
}: {
  control: EnrichedControl;
  listReturnTo: string;
}) {
  const {
    rule,
    triggered,
    recentCount,
    systemsCovered,
    lastTriggered,
    ownerTeam: team,
    signal,
    risk,
    bob,
    isRecurring
  } = control;
  const openIncidents = triggered.filter(
    (i: any) => i.incident_status !== "closed"
  ).length;
  const controlHref = appendReturnTo(routeToControl(rule.id), listReturnTo);

  return (
    <Card className="border-slate-200 p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
        <div className="min-w-0">
          <h3 className="truncate text-[13px] font-semibold leading-snug text-slate-900">
            <Link href={controlHref} className="hover:text-indigo-900 hover:underline">
              {rule.name}
            </Link>
          </h3>
          <p className="mt-0.5 truncate font-mono text-[10px] text-slate-400">{rule.id}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-semibold",
              severityBadgeClasses(rule.severity)
            )}
          >
            {humanizeLabel(rule.severity)}
          </span>
          {bob ? (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wide text-indigo-800">
              <BobIcon size="xs" withBackground={false} />
              Bob
            </span>
          ) : null}
        </div>
      </div>

      <p className="mt-2 line-clamp-2 text-[11px] leading-snug text-slate-600" title={rule.description}>
        {rule.description || "—"}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
        <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", signalColor(signal))}>
          {signal}
        </span>
        <Badge tone="neutral" size="xs" className="font-normal">
          {risk}
        </Badge>
        <span className="min-w-0 truncate text-slate-600" title={team}>
          {team}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-slate-100 pt-2 text-[11px]">
        <StatInline label="Systems" value={formatInteger(systemsCovered)} />
        <StatInline label="7d" value={formatInteger(recentCount)} emphasize={recentCount > 0} />
        <StatInline label="Total" value={formatInteger(triggered.length)} />
        <StatInline
          label="Last"
          value={lastTriggered ? formatRelativeTime(lastTriggered) : "—"}
          muted={!lastTriggered}
        />
      </div>

      {bob ? (
        <div className="mt-2 border-t border-slate-100 pt-2">
          <p className="text-[11px] leading-snug text-slate-700">{bob.summary}</p>
          <p className="mt-1 text-[10px] text-slate-500">
            <span className="capitalize">{bob.confidence}</span>
            {bob.suggested_owner ? (
              <>
                {" "}
                · Owner: <span className="text-slate-700">{bob.suggested_owner}</span>
              </>
            ) : null}
          </p>
        </div>
      ) : isRecurring ? (
        <p className="mt-2 border-t border-slate-100 pt-2 text-[11px] text-slate-600">
          Recurring: {recentCount} fires (7d) · consider Bob review when ready.
        </p>
      ) : null}

      <details className="group/rule mt-2 border-t border-slate-100 pt-2">
        <summary className="cursor-pointer list-none text-[10px] font-medium uppercase tracking-wide text-slate-500 marker:content-none [&::-webkit-details-marker]:hidden hover:text-slate-800">
          <span className="inline-flex items-center gap-0.5">
            <ChevronRight className="h-3 w-3 transition group-open/rule:rotate-90" />
            Rule definition
          </span>
        </summary>
        <code className="mt-1.5 block break-all rounded border border-slate-100 bg-slate-50/80 px-2 py-1.5 font-mono text-[10px] text-slate-600">
          {rule.observed_field} {rule.comparator} {rule.threshold_field}
        </code>
      </details>

      <div className="mt-2 flex flex-col items-stretch gap-2 border-t border-slate-100 pt-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <Link
          href={controlHref}
          className="inline-flex items-center justify-center rounded border border-slate-900 bg-slate-900 px-2 py-1 text-center text-[11px] font-semibold text-white hover:bg-slate-800"
        >
          View control
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {openIncidents > 0 ? (
            <Link
              href={appendReturnTo(
                routeToIncidentsForControl(rule.id),
                listReturnTo
              )}
              className="text-[11px] font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
            >
              Open incidents ({formatInteger(openIncidents)})
            </Link>
          ) : triggered.length > 0 ? (
            <Link
              href={appendReturnTo(
                routeToIncidentsForControl(rule.id),
                listReturnTo
              )}
              className="text-[10px] font-medium text-slate-400 hover:text-slate-600"
            >
              Incident history
            </Link>
          ) : null}
          {bob ? (
            <Link
              href={appendReturnTo(routeToBobInvestigation(bob.id), listReturnTo)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-800 hover:text-indigo-950"
            >
              <BobIcon size="xs" withBackground={false} />
              Bob review
            </Link>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function StatInline({
  label,
  value,
  emphasize,
  muted
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  muted?: boolean;
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <span
        className={cn(
          "tabular-nums text-[13px] font-semibold",
          emphasize
            ? "text-rose-700"
            : muted
            ? "text-slate-500"
            : "text-slate-900"
        )}
      >
        {value}
      </span>
    </span>
  );
}
