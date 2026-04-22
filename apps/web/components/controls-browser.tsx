"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Search, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
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
import { BobEyebrow } from "@/components/bob/bob-icon";

type Props = {
  rules: any[];
  incidents: any[];
  bobControlReviews?: any[];
};

export function ControlsBrowser({ rules, incidents, bobControlReviews = [] }: Props) {
  const bobByControl = useMemo(() => {
    const map: Record<string, any> = {};
    for (const inv of bobControlReviews) {
      if (inv.target_id) map[inv.target_id] = inv;
    }
    return map;
  }, [bobControlReviews]);
  const searchParams = useSearchParams();
  const initialQuery = searchParams?.get("q") ?? "";
  const [severity, setSeverity] = useState("all");
  const [signalType, setSignalType] = useState("all");
  const [riskDomain, setRiskDomain] = useState("all");
  const [ownerTeam, setOwnerTeam] = useState("all");
  const [recency, setRecency] = useState("all");
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    const q = searchParams?.get("q");
    if (q != null) setQuery(q);
  }, [searchParams]);

  const now = Date.now();
  const within7d = 7 * 24 * 60 * 60 * 1000;

  const enriched = useMemo(() => {
    const incidentsByRule: Record<string, any[]> = {};
    for (const inc of incidents) (incidentsByRule[inc.rule_id] ??= []).push(inc);
    return rules.map((rule: any) => {
      const triggered = incidentsByRule[rule.id] ?? [];
      const systemsCovered = new Set(triggered.map((i: any) => i.system_id)).size;
      const recent = triggered.filter((i: any) => now - new Date(i.created_at).getTime() <= within7d);
      const lastTriggered = triggered[0]?.created_at;
      const ownerTeam = triggered[0]?.owner_team ?? "Governance Operations";
      const signal = signalTypeForField(rule.observed_field);
      const risk = riskDomainFromCategory(rule.category);
      const consequence = triggered[0]?.recommended_action ?? "Review playbook and route to owning team.";
      return {
        rule,
        triggered,
        recentCount: recent.length,
        systemsCovered,
        lastTriggered,
        ownerTeam,
        signal,
        risk,
        consequence
      };
    });
  }, [rules, incidents, now, within7d]);

  const signalTypes = useMemo(() => [...new Set(enriched.map((e) => e.signal))].sort(), [enriched]);
  const riskDomains = useMemo(() => [...new Set(enriched.map((e) => e.risk))].sort(), [enriched]);
  const ownerTeams = useMemo(() => [...new Set(enriched.map((e) => e.ownerTeam))].sort(), [enriched]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enriched
      .filter(({ rule, signal, risk, ownerTeam: team, recentCount }) => {
        if (severity !== "all" && rule.severity !== severity) return false;
        if (signalType !== "all" && signal !== signalType) return false;
        if (riskDomain !== "all" && risk !== riskDomain) return false;
        if (ownerTeam !== "all" && team !== ownerTeam) return false;
        if (recency === "recent" && recentCount === 0) return false;
        if (recency === "quiet" && recentCount > 0) return false;
        if (q) {
          const hay = [rule.name, rule.description, rule.observed_field, rule.id]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (b.recentCount !== a.recentCount) return b.recentCount - a.recentCount;
        const sev = severityRank(b.rule.severity) - severityRank(a.rule.severity);
        if (sev !== 0) return sev;
        return b.triggered.length - a.triggered.length;
      });
  }, [enriched, severity, signalType, riskDomain, ownerTeam, recency, query]);

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
          <Select value={signalType} onChange={(e) => setSignalType(e.target.value)}>
            <option value="all">All signal types</option>
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
            <option value="all">All owner teams</option>
            {ownerTeams.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </Select>
          <Select value={recency} onChange={(e) => setRecency(e.target.value)}>
            <option value="all">Any recency</option>
            <option value="recent">Triggered in last 7d</option>
            <option value="quiet">No recent triggers</option>
          </Select>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
          <span>
            <span className="font-semibold tabular-nums text-slate-900">{filtered.length}</span> of{" "}
            {rules.length} controls
          </span>
          <span>
            {formatInteger(filtered.reduce((acc, c) => acc + c.recentCount, 0))} incidents in the last
            7 days
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {filtered.map(({ rule, triggered, recentCount, systemsCovered, lastTriggered, ownerTeam: team, signal, risk, consequence }) => (
          <Card key={rule.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-slate-400" />
                  <h3 className="truncate text-sm font-semibold text-slate-900">{rule.name}</h3>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-slate-600">{rule.description}</p>
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

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", signalColor(signal))}>
                Signal · {signal}
              </span>
              <Badge tone="neutral" size="xs">
                Risk · {risk}
              </Badge>
              <Badge tone="outline" size="xs">
                Owner · {team}
              </Badge>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border border-slate-100 bg-slate-50/50 p-2.5 text-xs md:grid-cols-4">
              <Stat label="Systems covered" value={formatInteger(systemsCovered)} />
              <Stat label="Incidents (7d)" value={formatInteger(recentCount)} emphasize={recentCount > 0} />
              <Stat label="Total fires" value={formatInteger(triggered.length)} />
              <Stat
                label="Last triggered"
                value={lastTriggered ? formatRelativeTime(lastTriggered) : "Quiet"}
              />
            </dl>

            <div className="mt-3 rounded-md border border-amber-100 bg-amber-50 px-3 py-2">
              <p className="label-eyebrow text-amber-700">Recommended action</p>
              <p className="mt-0.5 text-xs text-amber-900">{consequence}</p>
            </div>

            {bobByControl[rule.id] ? (
              <div className="mt-3 rounded-md border border-indigo-100 bg-indigo-50/50 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <BobEyebrow label="Bob Control Review" />
                  <AnalyzeWithBob
                    targetType="control"
                    targetId={rule.id}
                    hasInvestigation
                    label="Open Bob review"
                  />
                </div>
                <p className="mt-1 text-xs leading-snug text-slate-700">
                  {bobByControl[rule.id].summary}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                  <span>
                    Confidence:{" "}
                    <span className="font-medium capitalize text-slate-700">
                      {bobByControl[rule.id].confidence}
                    </span>
                  </span>
                  <span>
                    Suggested owner:{" "}
                    <span className="font-medium text-slate-700">
                      {bobByControl[rule.id].suggested_owner}
                    </span>
                  </span>
                </div>
              </div>
            ) : recentCount >= 3 ? (
              <div className="mt-3 rounded-md border border-indigo-100 bg-indigo-50/50 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <BobEyebrow label="Bob tuning candidate" />
                  <AnalyzeWithBob
                    targetType="control"
                    targetId={rule.id}
                    label="Run Bob review"
                  />
                </div>
                <p className="mt-1 text-xs leading-snug text-slate-700">
                  {recentCount} incidents across {systemsCovered} system(s) in
                  the last 7 days — this control is a candidate for Bob control
                  review before the next telemetry window.
                </p>
              </div>
            ) : null}

            <details className="group/logic mt-3 rounded-md border border-slate-200 bg-white">
              <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-[11px] font-medium text-slate-600 hover:text-slate-900">
                <span>Underlying logic</span>
                <ChevronRight className="h-3.5 w-3.5 transition group-open/logic:rotate-90" />
              </summary>
              <div className="border-t border-slate-100 px-3 py-2">
                <code className="block break-all font-mono text-[11px] text-slate-600">
                  {rule.observed_field} {rule.comparator} {rule.threshold_field}
                </code>
                <p className="mt-1 text-[11px] text-slate-500">
                  Control ID: <span className="font-mono">{rule.id}</span>
                </p>
              </div>
            </details>

            <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
              {triggered[0] ? (
                <Link
                  href={`/incidents/${triggered[0].id}`}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900"
                >
                  View latest incident
                  <ChevronRight className="h-3 w-3" />
                </Link>
              ) : (
                <span className="text-[11px] text-slate-400">
                  No incidents in window
                </span>
              )}
              {!bobByControl[rule.id] && recentCount < 3 ? (
                <AnalyzeWithBob
                  targetType="control"
                  targetId={rule.id}
                  label="Analyze control"
                />
              ) : null}
            </div>
          </Card>
        ))}
        {filtered.length === 0 ? (
          <div className="col-span-full rounded-lg border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            No controls match the current filters.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  emphasize
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 truncate tabular-nums text-sm font-semibold",
          emphasize ? "text-rose-700" : "text-slate-900"
        )}
      >
        {value}
      </dd>
    </div>
  );
}
