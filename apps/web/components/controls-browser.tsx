"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  LayoutGrid,
  List,
  Search,
  ShieldCheck
} from "lucide-react";
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
import { AnalyzeWithBob } from "@/components/bob/analyze-with-bob";
import { BobIcon } from "@/components/bob/bob-icon";
import { routeToBobInvestigation, routeToIncident } from "@/lib/routes";

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
 * Design intent: this page is an operating surface, not a catalog. It must
 * answer, at a glance, "which controls are firing most, which are quiet,
 * which has Bob flagged, and where do I go to investigate?" To keep the
 * density high we default to a compact row view and offer a cards view for
 * narrative review; both are driven by the same filter/sort state so the
 * operator never loses context when switching.
 */
export function ControlsBrowser({
  rules,
  incidents,
  bobControlReviews = []
}: Props) {
  const searchParams = useSearchParams();
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

      {/* Filter + search + view toggle bar */}
      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search controls…"
              className="h-8 w-full rounded-md border border-slate-200 bg-white pl-7 pr-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
            />
          </div>
          <Select value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="all">All severities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>
          <Select
            value={signalType}
            onChange={(e) => setSignalType(e.target.value)}
          >
            <option value="all">All signal types</option>
            {signalTypes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select
            value={riskDomain}
            onChange={(e) => setRiskDomain(e.target.value)}
          >
            <option value="all">All risk domains</option>
            {riskDomains.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
          <Select
            value={ownerTeam}
            onChange={(e) => setOwnerTeam(e.target.value)}
          >
            <option value="all">All owner teams</option>
            {ownerTeams.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </Select>
          <Select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            aria-label="Sort controls"
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                Sort · {SORT_LABELS[k]}
              </option>
            ))}
          </Select>
          <ViewToggle view={view} onChange={setView} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
          <span>
            <span className="font-semibold tabular-nums text-slate-900">
              {filtered.length}
            </span>{" "}
            of {rules.length} controls
          </span>
          <span>{formatInteger(totalRecent)} incidents · last 7d</span>
          {bucket !== "all" ? (
            <button
              type="button"
              onClick={() => setBucket("all")}
              className="font-medium text-slate-600 hover:text-slate-900"
            >
              Clear bucket filter
            </button>
          ) : null}
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          No controls match the current filters.
        </div>
      ) : view === "compact" ? (
        <CompactList rows={filtered} />
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {filtered.map((c) => (
            <ControlCard key={c.rule.id} control={c} />
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
                : "border-slate-200 hover:border-slate-300 hover:shadow-card-hover"
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

function CompactList({ rows }: { rows: EnrichedControl[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
      <div className="hidden grid-cols-[minmax(0,1.5fr)_110px_110px_minmax(0,1fr)_56px_56px_56px_110px_140px] items-center gap-3 border-b border-slate-200 bg-slate-50/70 px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-slate-500 md:grid">
        <span>Control</span>
        <span>Signal</span>
        <span>Risk</span>
        <span>Owner</span>
        <span className="text-right">Sys</span>
        <span className="text-right">7d</span>
        <span className="text-right">Total</span>
        <span>Last</span>
        <span className="text-right">Actions</span>
      </div>
      <ul className="divide-y divide-slate-100">
        {rows.map((c) => (
          <CompactRow key={c.rule.id} control={c} />
        ))}
      </ul>
    </div>
  );
}

function CompactRow({ control }: { control: EnrichedControl }) {
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
  const latestIncident = triggered[0];

  return (
    <li className="grid grid-cols-1 items-center gap-2 px-3 py-2.5 text-[12px] transition hover:bg-slate-50/60 md:grid-cols-[minmax(0,1.5fr)_110px_110px_minmax(0,1fr)_56px_56px_56px_110px_140px] md:gap-3">
      {/* Col 1 — Control identity */}
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <SeverityDot severity={rule.severity} />
          <span className="truncate font-semibold text-slate-900">
            {rule.name}
          </span>
          {bob ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 ring-1 ring-indigo-200"
              title={`Bob review: ${bob.summary}`}
            >
              <BobIcon size="xs" withBackground={false} />
              Bob flagged
            </span>
          ) : null}
        </div>
        <p
          className="mt-0.5 truncate text-[11px] text-slate-500"
          title={rule.description}
        >
          <span className="font-mono text-[10px] text-slate-400">
            {rule.id}
          </span>
          {rule.description ? (
            <>
              {" · "}
              {rule.description}
            </>
          ) : null}
        </p>
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

      {/* Col 9 — Actions */}
      <div className="flex items-center justify-end gap-1.5">
        {bob ? (
          <Link
            href={routeToBobInvestigation(bob.id)}
            className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-white px-2 py-1 text-[11px] font-medium text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-50"
          >
            <BobIcon size="xs" withBackground={false} />
            Open review
          </Link>
        ) : null}
        {latestIncident ? (
          <Link
            href={routeToIncident(latestIncident.id)}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            aria-label="Open latest incident"
            title="Open latest incident"
          >
            Latest
            <ChevronRight className="h-3 w-3" />
          </Link>
        ) : (
          <span className="text-[11px] text-slate-400">—</span>
        )}
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

function ControlCard({ control }: { control: EnrichedControl }) {
  const {
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
    isActive,
    isRecurring,
    isQuiet
  } = control;

  return (
    <Card className="p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-slate-400" />
            <h3 className="truncate text-sm font-semibold text-slate-900">
              {rule.name}
            </h3>
            {bob ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 ring-1 ring-indigo-200">
                <BobIcon size="xs" withBackground={false} />
                Bob flagged
              </span>
            ) : null}
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-slate-600">
            {rule.description}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
            severityBadgeClasses(rule.severity)
          )}
        >
          {humanizeLabel(rule.severity)}
        </span>
      </div>

      {/* Chip row */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-medium",
            signalColor(signal)
          )}
        >
          Signal · {signal}
        </span>
        <Badge tone="neutral" size="xs">
          Risk · {risk}
        </Badge>
        <Badge tone="outline" size="xs">
          Owner · {team}
        </Badge>
      </div>

      {/* Inline stat strip — no more 4-up dl grid */}
      <div className="mt-2.5 flex flex-wrap items-baseline gap-x-5 gap-y-1 rounded-md border border-slate-100 bg-slate-50/60 px-3 py-2 text-[11px]">
        <StatInline label="Systems" value={formatInteger(systemsCovered)} />
        <StatInline
          label="7d"
          value={formatInteger(recentCount)}
          emphasize={recentCount > 0}
        />
        <StatInline label="Total" value={formatInteger(triggered.length)} />
        <StatInline
          label="Last"
          value={lastTriggered ? formatRelativeTime(lastTriggered) : "Quiet"}
          muted={!lastTriggered}
        />
      </div>

      {/* State-aware callout */}
      {isActive ? (
        <div className="mt-2.5 rounded-md border border-amber-100 bg-amber-50 px-3 py-2">
          <p className="label-eyebrow text-amber-700">Recommended action</p>
          <p className="mt-0.5 text-xs text-amber-900">{consequence}</p>
        </div>
      ) : (
        <div className="mt-2.5 rounded-md border border-emerald-100 bg-emerald-50/60 px-3 py-2">
          <p className="label-eyebrow text-emerald-700">Quiet in window</p>
          <p className="mt-0.5 text-xs text-emerald-900">
            No fires in the last 7 days. Coverage still enforced across{" "}
            {systemsCovered || "monitored"} system
            {systemsCovered === 1 ? "" : "s"}.
          </p>
        </div>
      )}

      {/* Bob block — only when meaningful */}
      {bob ? (
        <div className="mt-2.5 rounded-md border border-indigo-100 bg-indigo-50/50 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-indigo-700">
              <BobIcon size="xs" withBackground={false} />
              Bob control review
            </span>
            <AnalyzeWithBob
              targetType="control"
              targetId={rule.id}
              investigationId={bob.id}
              hasInvestigation
              label="Open Bob review"
            />
          </div>
          <p className="mt-1 text-xs leading-snug text-slate-700">
            {bob.summary}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
            <span>
              Confidence:{" "}
              <span className="font-medium capitalize text-slate-700">
                {bob.confidence}
              </span>
            </span>
            <span>
              Suggested owner:{" "}
              <span className="font-medium text-slate-700">
                {bob.suggested_owner}
              </span>
            </span>
          </div>
        </div>
      ) : isRecurring ? (
        <div className="mt-2.5 rounded-md border border-indigo-100 bg-indigo-50/40 px-3 py-2 text-[11px] text-slate-700">
          <span className="inline-flex items-center gap-1.5 font-semibold text-indigo-700">
            <BobIcon size="xs" withBackground={false} />
            Bob tuning candidate
          </span>
          <span className="ml-1.5 text-slate-600">
            · {recentCount} fires across {systemsCovered} system
            {systemsCovered === 1 ? "" : "s"} in 7d. Queued for next review
            window.
          </span>
        </div>
      ) : null}

      {/* Footer row — logic disclosure + primary op actions */}
      <details className="group/logic mt-2.5 rounded-md border border-slate-200 bg-white">
        <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:text-slate-900">
          <span className="inline-flex items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5 transition group-open/logic:rotate-90" />
            Logic · <span className="font-mono text-slate-500">{rule.id}</span>
          </span>
        </summary>
        <div className="border-t border-slate-100 px-3 py-2">
          <code className="block break-all font-mono text-[11px] text-slate-600">
            {rule.observed_field} {rule.comparator} {rule.threshold_field}
          </code>
        </div>
      </details>

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-[11px]">
        {triggered[0] ? (
          <Link
            href={routeToIncident(triggered[0].id)}
            className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-slate-900"
          >
            View latest incident
            <ChevronRight className="h-3 w-3" />
          </Link>
        ) : (
          <span className="text-slate-400">
            {isQuiet
              ? "No incidents in window · coverage still enforced"
              : "No incidents in window"}
          </span>
        )}
        {!bob && !isRecurring ? (
          <span
            className="text-slate-400"
            title="Bob has not opened a review for this control in the current window."
          >
            No Bob review in window
          </span>
        ) : null}
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
