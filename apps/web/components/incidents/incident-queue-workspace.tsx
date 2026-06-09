"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Select } from "@/components/ui/select";
import { SummaryMini } from "@/components/ui/summary-mini";
import {
  formatQueueEvidenceLabel,
  PRIMARY_OWNER_QUEUE_TEAMS,
  type OwnerReviewTableRow,
  type QueueTableRow
} from "@/lib/incident-queue-types";
import {
  buildOwnerInsightsFromApi,
  buildOwnerPackageMetaFromApi
} from "@/lib/dashboard-merge";
import { handoffIncidentToActionCenter } from "@/lib/governance-api";
import { normalizeAiScope, withAiScope, type AiScopeId } from "@/lib/ai-scope";
import {
  routeToEvidenceLibraryIncidentRecord,
  routeToIncidentsOwnerQueue,
  routeToIncidentsQueue,
  routes
} from "@/lib/routes";
import { useGovernanceData } from "@/hooks/use-governance-data";
import {
  buildGlobalOwnerQueueRowsFromApi,
  buildOwnerQueueRowsFromApi
} from "@/lib/governance-merge";

const STAGE_OPTIONS = [
  "All",
  "Packaged",
  "Owner Review",
  "Action Approval",
  "Remediation",
  "Verification",
  "Closed"
] as const;

const SEVERITY_OPTIONS = ["All", "Critical", "High", "Medium", "Low"] as const;

const RISK_OPTIONS = [
  "All",
  "Output Reliability",
  "Governance",
  "Technology",
  "Cyber"
] as const;

const PRIORITY_RANK: Record<OwnerReviewTableRow["priority"], number> = {
  P1: 0,
  P2: 1,
  P3: 2
};

function decodeOwner(v: string | null): string | null {
  if (!v) return null;
  return decodeURIComponent(String(v).replace(/\+/g, " "));
}

function parseAgeDays(label: string): number {
  const m = label.match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

function severityRank(label: string): number {
  if (label === "Critical") return 0;
  if (label === "High") return 1;
  if (label === "Medium") return 2;
  return 3;
}

function stageRank(stage: string): number {
  if (stage === "Owner Review" || stage === "Action Approval") return 0;
  if (stage === "Verification") return 1;
  return 2;
}

export function pickDefaultOwnerIncident(
  rows: Pick<OwnerReviewTableRow, "priority" | "severityLabel" | "ageLabel" | "stage">[]
): OwnerReviewTableRow | null {
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => {
    const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (pr !== 0) return pr;
    const sr = severityRank(a.severityLabel) - severityRank(b.severityLabel);
    if (sr !== 0) return sr;
    const age = parseAgeDays(b.ageLabel) - parseAgeDays(a.ageLabel);
    if (age !== 0) return age;
    return stageRank(a.stage) - stageRank(b.stage);
  });
  return sorted[0] as OwnerReviewTableRow;
}

function severityTextClass(severity: string): string {
  if (severity === "Critical" || severity === "High") return "text-rose-800";
  if (severity === "Medium") return "text-amber-800";
  return "text-emerald-800";
}

function matchesRiskFilter(row: OwnerReviewTableRow, risk: string): boolean {
  if (risk === "All") return true;
  if (risk === "Cyber") {
    return row.riskCategory === "Cyber" || row.riskCategory.startsWith("Cyber");
  }
  if (risk === "Technology") {
    return (
      row.riskCategory === "Technology" || row.riskCategory.startsWith("Technology")
    );
  }
  return row.riskCategory === risk;
}

function globalQueueSummaryFromInsights(
  ownerInsights: ReturnType<typeof buildOwnerInsightsFromApi>
) {
  const teams = ownerInsights.filter((row) =>
    (PRIMARY_OWNER_QUEUE_TEAMS as readonly string[]).includes(row.ownerTeam)
  );
  const oldest = teams
    .map((t) => t.oldestEvidenceAge)
    .sort((a, b) => parseAgeDays(b) - parseAgeDays(a))[0];
  return {
    decisionsWaiting: teams.reduce((s, t) => s + t.decisionsNeeded, 0),
    critical: teams.reduce((s, t) => s + t.critical, 0),
    evidenceRecords: teams.reduce((s, t) => s + t.open, 0),
    oldest: oldest ?? "—",
    bottleneck:
      teams.sort((a, b) => b.decisionsNeeded - a.decisionsNeeded)[0]?.bottleneck ??
      "Monitoring"
  };
}

type WorkbenchProps = {
  mode: "owner" | "global";
  lockedOwnerTeam?: string;
  initialOwnerFilter?: string;
  scopeHref: (path: string) => string;
  pathname: string;
  initialIncidentId: string | null;
};

function IncidentQueueWorkbench({
  mode,
  lockedOwnerTeam,
  initialOwnerFilter = "All",
  scopeHref,
  pathname,
  initialIncidentId
}: WorkbenchProps) {
  const router = useRouter();
  const isOwnerMode = mode === "owner" && Boolean(lockedOwnerTeam);
  const ownerTeam = lockedOwnerTeam ?? "";

  const { ownerQueues, evidenceByAlias, dashboard } = useGovernanceData();

  const ownerInsights = useMemo(
    () => buildOwnerInsightsFromApi(ownerQueues, dashboard),
    [ownerQueues, dashboard]
  );

  const insight = isOwnerMode
    ? ownerInsights.find((o) => o.ownerTeam === ownerTeam)
    : null;

  const details = useMemo(() => {
    if (!isOwnerMode) return null;
    const meta = buildOwnerPackageMetaFromApi(ownerTeam, ownerQueues, ownerInsights);
    return {
      notificationStatus: meta.handoff.split(" · ")[0] ?? "Monitoring",
      teamLead: meta.teamLead,
      lastNotifiedAt: meta.lastUpdated,
      members: meta.reviewers === "—" ? [] : meta.reviewers.split(", ")
    };
  }, [isOwnerMode, ownerTeam, ownerQueues, ownerInsights]);

  const globalSummary = useMemo(
    () => globalQueueSummaryFromInsights(ownerInsights),
    [ownerInsights]
  );

  const headerKpi = useMemo(() => {
    if (dashboard) {
      return {
        activeIncidents: dashboard.active_incidents,
        criticalDecisions: dashboard.decisions_needed,
        ownersAboveTolerance: Object.values(dashboard.owner_open_counts).filter(
          (count) => (count ?? 0) > 0
        ).length
      };
    }
    return {
      activeIncidents: 0,
      criticalDecisions: 0,
      ownersAboveTolerance: 0
    };
  }, [dashboard]);

  const allRows = useMemo((): QueueTableRow[] => {
    if (isOwnerMode) {
      return buildOwnerQueueRowsFromApi(
        ownerQueues[ownerTeam] ?? null,
        evidenceByAlias,
        ownerTeam
      );
    }
    return buildGlobalOwnerQueueRowsFromApi(ownerQueues, evidenceByAlias);
  }, [isOwnerMode, ownerTeam, ownerQueues, evidenceByAlias]);

  const evidenceRecords = allRows.reduce((sum, row) => sum + row.evidenceItemsCount, 0);

  const [stageFilter, setStageFilter] = useState("All");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [assignedFilter, setAssignedFilter] = useState("All");
  const [riskFilter, setRiskFilter] = useState("All");
  const [ownerFilter, setOwnerFilter] = useState(initialOwnerFilter);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (initialIncidentId && allRows.some((r) => r.incidentId === initialIncidentId)) {
      return initialIncidentId;
    }
    const picked = pickDefaultOwnerIncident(allRows);
    return picked?.incidentId ?? null;
  });
  const [toast, setToast] = useState<string | null>(null);
  const [stageOverrides, setStageOverrides] = useState<Record<string, string>>({});

  const assignees = useMemo(
    () => [...new Set(allRows.map((r) => r.assignedTo))].sort(),
    [allRows]
  );

  const ownerTeams = useMemo(
    () => [...new Set(allRows.map((r) => r.ownerTeam))].sort(),
    [allRows]
  );

  const filteredRows = useMemo(() => {
    return allRows.filter((row) => {
      const stage = stageOverrides[row.incidentId] ?? row.stage;
      if (stageFilter !== "All" && stage !== stageFilter) return false;
      if (severityFilter !== "All" && row.severityLabel !== severityFilter) return false;
      if (assignedFilter !== "All" && row.assignedTo !== assignedFilter) return false;
      if (!matchesRiskFilter(row, riskFilter)) return false;
      if (!isOwnerMode && ownerFilter !== "All" && row.ownerTeam !== ownerFilter) return false;
      return true;
    });
  }, [
    allRows,
    stageFilter,
    severityFilter,
    assignedFilter,
    riskFilter,
    ownerFilter,
    isOwnerMode,
    stageOverrides
  ]);

  const syncUrl = useCallback(
    (incidentId: string | null) => {
      const qs = new URLSearchParams();
      if (isOwnerMode) {
        qs.set("queue", "owner");
        qs.set("owner", ownerTeam);
      }
      if (stageFilter !== "All") qs.set("stage", stageFilter);
      if (severityFilter !== "All") qs.set("severity", severityFilter);
      if (assignedFilter !== "All") qs.set("assigned", assignedFilter);
      if (riskFilter !== "All") qs.set("risk", riskFilter);
      if (!isOwnerMode && ownerFilter !== "All") qs.set("owner", ownerFilter);
      if (incidentId) qs.set("incident", incidentId);
      const scope = new URLSearchParams(window.location.search).get("scope");
      if (scope) qs.set("scope", scope);
      router.replace(qs.toString() ? `${pathname}?${qs.toString()}` : pathname, {
        scroll: false
      });
    },
    [
      router,
      pathname,
      isOwnerMode,
      ownerTeam,
      stageFilter,
      severityFilter,
      assignedFilter,
      riskFilter,
      ownerFilter
    ]
  );

  useEffect(() => {
    if (!filteredRows.length) {
      setSelectedId(null);
      return;
    }
    const stillVisible = filteredRows.some((r) => r.incidentId === selectedId);
    if (!stillVisible) {
      const next = pickDefaultOwnerIncident(filteredRows);
      setSelectedId(next?.incidentId ?? null);
    }
  }, [filteredRows, selectedId]);

  useEffect(() => {
    syncUrl(selectedId);
  }, [selectedId, syncUrl]);

  const selectedRow = useMemo(
    () => filteredRows.find((r) => r.incidentId === selectedId) ?? null,
    [filteredRows, selectedId]
  );

  const effectiveStage = selectedRow
    ? (stageOverrides[selectedRow.incidentId] ?? selectedRow.stage)
    : null;

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  };

  const clearOwnerMode = () => {
    const defaultRow = pickDefaultOwnerIncident(allRows);
    router.replace(
      scopeHref(
        routeToIncidentsQueue(
          defaultRow ? { incidentId: defaultRow.incidentId } : undefined
        )
      ),
      { scroll: false }
    );
  };

  const openOwnerQueue = (team: string, incidentId?: string) => {
    router.push(scopeHref(routeToIncidentsOwnerQueue(team, incidentId)));
  };

  const sendToActionCenter = async () => {
    if (!selectedRow) return;
    const ok = await handoffIncidentToActionCenter(selectedRow.incidentId);
    if (!ok) {
      showToast("Could not send to Action Center — check API connection");
      return;
    }
    setStageOverrides((prev) => ({
      ...prev,
      [selectedRow.incidentId]: "Action Approval"
    }));
    showToast("Sent to Action Center");
  };

  if (isOwnerMode && !insight) {
    return (
      <p className="text-[13px] text-slate-600">
        No owner queue data for <span className="font-medium">{ownerTeam}</span>.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <header className="space-y-3 border-b border-slate-100 pb-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Incident Queue
          </p>
          {isOwnerMode ? (
            <>
              <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-slate-900">
                Owner Queue: {ownerTeam}
              </h1>
              <p className="mt-1 text-[13px] text-slate-600">
                {insight?.decisionsNeeded ?? 0} decisions waiting · {insight?.critical ?? 0}{" "}
                critical incidents · oldest {insight?.oldestEvidenceAge ?? "—"}
              </p>
            </>
          ) : (
            <>
              <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-slate-900">
                Incident Queue
              </h1>
              <p className="mt-1 text-[13px] font-medium text-slate-800">
                All governance incidents
              </p>
              <p className="text-[13px] text-slate-600">
                {headerKpi.activeIncidents} open · {headerKpi.criticalDecisions}{" "}
                decisions waiting · {headerKpi.ownersAboveTolerance} owners above risk
                tolerance
              </p>
            </>
          )}
        </div>
        {isOwnerMode && details ? (
          <div className="grid gap-2 text-[12px] text-slate-700 sm:grid-cols-2 lg:grid-cols-3">
            <p>
              <span className="text-slate-500">Handoff:</span>{" "}
              <span className="font-medium text-slate-900">
                {details.notificationStatus} · {details.teamLead} · {details.lastNotifiedAt}
              </span>
            </p>
            <p>
              <span className="text-slate-500">Assigned reviewers:</span>{" "}
              <span className="font-medium text-slate-900">{details.members.join(", ")}</span>
            </p>
            <p>
              <span className="text-slate-500">Evidence library:</span>{" "}
              <span className="font-medium text-slate-900">
                {insight?.open ?? 0} active incident records · {evidenceRecords} evidence items
              </span>
            </p>
          </div>
        ) : null}
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {isOwnerMode && insight ? (
          <>
            <SummaryMini label="Decisions waiting" value={String(insight.decisionsNeeded)} />
            <SummaryMini label="Critical incidents" value={String(insight.critical)} />
            <SummaryMini label="Current bottleneck" value={insight.bottleneck} />
            <SummaryMini label="Oldest active" value={insight.oldestEvidenceAge} />
            <SummaryMini label="Evidence records" value={String(evidenceRecords)} />
          </>
        ) : (
          <>
            <SummaryMini
              label="Decisions waiting"
              value={String(globalSummary.decisionsWaiting)}
            />
            <SummaryMini label="Critical incidents" value={String(globalSummary.critical)} />
            <SummaryMini label="Current bottleneck" value={globalSummary.bottleneck} />
            <SummaryMini label="Oldest active" value={globalSummary.oldest} />
            <SummaryMini label="Evidence records" value={String(globalSummary.evidenceRecords)} />
          </>
        )}
      </div>

      {!isOwnerMode ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium text-slate-500">View</span>
          <div className="inline-flex rounded-md border border-slate-200 p-0.5">
            <button
              type="button"
              onClick={() => setOwnerFilter("All")}
              className={cn(
                "rounded px-3 py-1.5 text-[11px] font-semibold transition",
                ownerFilter === "All"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              )}
            >
              All incidents
            </button>
            <button
              type="button"
              onClick={() =>
                setOwnerFilter(
                  ownerTeams[0] ?? PRIMARY_OWNER_QUEUE_TEAMS[0] ?? "All"
                )
              }
              className={cn(
                "rounded px-3 py-1.5 text-[11px] font-semibold transition",
                ownerFilter !== "All"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              )}
            >
              By owner team
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {isOwnerMode ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-800">
            Owner Team: {ownerTeam}
            <button
              type="button"
              onClick={clearOwnerMode}
              className="rounded p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
              aria-label="Clear owner filter and show all incidents"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ) : ownerFilter !== "All" ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-800">
            Owner: {ownerFilter}
            <button
              type="button"
              onClick={() => setOwnerFilter("All")}
              className="rounded p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
              aria-label="Clear owner filter"
            >
              <X className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => openOwnerQueue(ownerFilter, selectedId ?? undefined)}
              className="ml-1 text-[10px] font-semibold text-slate-600 underline underline-offset-2"
            >
              Owner queue →
            </button>
          </span>
        ) : null}
        {!isOwnerMode ? (
          <Select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="h-8 min-w-[160px] text-[11px]"
          >
            <option value="All">Owner team: All</option>
            {ownerTeams.map((t) => (
              <option key={t} value={t}>
                Owner team: {t}
              </option>
            ))}
          </Select>
        ) : null}
        <Select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="h-8 min-w-[130px] text-[11px]"
        >
          {STAGE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              Stage: {s}
            </option>
          ))}
        </Select>
        <Select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="h-8 min-w-[120px] text-[11px]"
        >
          {SEVERITY_OPTIONS.map((s) => (
            <option key={s} value={s}>
              Severity: {s}
            </option>
          ))}
        </Select>
        <Select
          value={assignedFilter}
          onChange={(e) => setAssignedFilter(e.target.value)}
          className="h-8 min-w-[140px] text-[11px]"
        >
          <option value="All">Assigned: All</option>
          {assignees.map((a) => (
            <option key={a} value={a}>
              Assigned: {a}
            </option>
          ))}
        </Select>
        <Select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          className="h-8 min-w-[150px] text-[11px]"
        >
          {RISK_OPTIONS.map((r) => (
            <option key={r} value={r}>
              Risk: {r}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(280px,340px)]">
        <div className="space-y-3">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50/80 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {isOwnerMode ? "Owner incidents" : "Governance incidents"} · {filteredRows.length}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[960px] w-full divide-y divide-slate-200 text-[12px]">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-2 text-left font-medium">Priority</th>
                  <th className="px-2 py-2 text-left font-medium">Incident</th>
                  {!isOwnerMode ? (
                    <th className="px-2 py-2 text-left font-medium">Owner</th>
                  ) : null}
                  <th className="px-2 py-2 text-left font-medium">System</th>
                  <th className="px-2 py-2 text-left font-medium">Risk</th>
                  <th className="px-2 py-2 text-left font-medium">Severity</th>
                  <th className="px-2 py-2 text-left font-medium">Stage</th>
                  <th className="px-2 py-2 text-left font-medium">Assigned</th>
                  <th className="px-2 py-2 text-left font-medium">Evidence</th>
                  <th className="px-2 py-2 text-left font-medium">Age</th>
                  <th className="px-2 py-2 text-left font-medium">Next action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => {
                  const stage = stageOverrides[row.incidentId] ?? row.stage;
                  const selected = row.incidentId === selectedId;
                  return (
                    <tr
                      key={row.incidentId}
                      onClick={() => setSelectedId(row.incidentId)}
                      className={cn(
                        "cursor-pointer transition hover:bg-slate-50/90",
                        selected && "border-l-2 border-l-slate-900 bg-slate-50"
                      )}
                    >
                      <td className="whitespace-nowrap px-2 py-2 font-semibold tabular-nums text-slate-900">
                        {row.priority}
                      </td>
                      <td className="max-w-[180px] px-2 py-2 font-medium text-slate-900">
                        {row.title}
                      </td>
                      {!isOwnerMode ? (
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openOwnerQueue(row.ownerTeam, row.incidentId);
                            }}
                            className="text-left text-[11px] font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                          >
                            {row.ownerTeam}
                          </button>
                        </td>
                      ) : null}
                      <td className="px-2 py-2 text-slate-700">{row.systemName}</td>
                      <td className="px-2 py-2 text-slate-600">{row.riskCategory}</td>
                      <td
                        className={cn(
                          "whitespace-nowrap px-2 py-2 font-medium",
                          severityTextClass(row.severityLabel)
                        )}
                      >
                        {row.severityLabel}
                      </td>
                      <td className="px-2 py-2 text-slate-700">{stage}</td>
                      <td className="px-2 py-2 text-slate-700">{row.assignedTo}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-[11px] text-slate-600">
                        {formatQueueEvidenceLabel(row)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-slate-500">
                        {row.ageLabel}
                      </td>
                      <td className="px-2 py-2 text-[11px] font-semibold text-slate-800">
                        {row.nextAction}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredRows.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-slate-500">
              No incidents match these filters.
            </p>
          ) : null}
        </div>

        <RecentQueueActivity
          ownerTeam={
            isOwnerMode
              ? ownerTeam
              : ownerFilter !== "All"
                ? ownerFilter
                : null
          }
          rows={filteredRows}
        />
        </div>

        <aside className="rounded-lg border border-slate-200 bg-white shadow-sm lg:sticky lg:top-4 lg:self-start">
          {selectedRow ? (
            <IncidentDetailPanel
              row={selectedRow}
              ownerTeam={selectedRow.ownerTeam}
              stage={effectiveStage ?? selectedRow.stage}
              scopeHref={scopeHref}
              isOwnerMode={isOwnerMode}
              fleetracSummary={
                evidenceByAlias[selectedRow.incidentId]?.fleetrac_analysis?.summary ??
                selectedRow.evidenceSummary
              }
              onSendToActionCenter={sendToActionCenter}
              onOpenOwnerQueue={
                !isOwnerMode
                  ? () => openOwnerQueue(selectedRow.ownerTeam, selectedRow.incidentId)
                  : undefined
              }
            />
          ) : (
            <p className="p-4 text-[13px] text-slate-500">Select an incident to review.</p>
          )}
        </aside>
      </div>

      {toast ? (
        <div
          className="fixed bottom-4 right-4 z-50 rounded-md border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium shadow-lg"
          role="status"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function IncidentDetailPanel({
  row,
  ownerTeam,
  stage,
  scopeHref,
  isOwnerMode,
  fleetracSummary,
  onSendToActionCenter,
  onOpenOwnerQueue
}: {
  row: QueueTableRow;
  ownerTeam: string;
  stage: string;
  scopeHref: (path: string) => string;
  isOwnerMode: boolean;
  fleetracSummary: string;
  onSendToActionCenter: () => void;
  onOpenOwnerQueue?: () => void;
}) {
  const evidenceHref = scopeHref(
    routeToEvidenceLibraryIncidentRecord(row.incidentId, ownerTeam)
  );

  return (
    <div className="flex flex-col">
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Incident Detail
        </p>
        <h2 className="mt-1 text-[15px] font-semibold leading-snug text-slate-900">{row.title}</h2>
        <p className="mt-1 text-[12px] text-slate-600">
          {row.systemName} · {row.riskCategory} · {row.severityLabel}
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px]">
          <div>
            <dt className="text-slate-500">Stage</dt>
            <dd className="font-medium text-slate-900">{stage}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Assigned</dt>
            <dd className="font-medium text-slate-900">{row.assignedTo}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Evidence</dt>
            <dd className="font-medium text-slate-900">{formatQueueEvidenceLabel(row)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Age</dt>
            <dd className="font-medium text-slate-900">{row.ageLabel}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-slate-500">Owner</dt>
            <dd className="font-medium text-slate-900">{ownerTeam}</dd>
          </div>
        </dl>
      </div>

      <div className="space-y-3 px-4 py-3 text-[12px] leading-relaxed text-slate-700">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Decision needed
          </p>
          <p className="mt-1 font-medium text-slate-900">{row.decisionNeeded}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Fleetrac analysis
          </p>
          <p className="mt-1 text-slate-700">{fleetracSummary}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Recommended action
          </p>
          <p className="mt-1 text-slate-800">{row.recommendedAction}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Lifecycle
          </p>
          <p className="mt-1 text-slate-600">{row.investigationTimeline}</p>
        </div>
      </div>

      <div className="space-y-2 border-t border-slate-100 px-4 py-3">
        <Link
          href={evidenceHref}
          className={cn(
            "flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2 text-[12px] font-semibold shadow-sm transition",
            isOwnerMode
              ? "bg-slate-900 text-white hover:bg-slate-800"
              : "border border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50"
          )}
        >
          Open evidence record
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
        <button
          type="button"
          onClick={onSendToActionCenter}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-800 hover:bg-slate-50"
        >
          Send to Action Center
        </button>
        {onOpenOwnerQueue ? (
          <button
            type="button"
            onClick={onOpenOwnerQueue}
            className="w-full text-center text-[11px] font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
          >
            Open owner queue
          </button>
        ) : null}
        {isOwnerMode ? (
          <p className="text-[10px] leading-snug text-slate-400">
            Review structured evidence in the library before approving remediation in Action
            Center.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function RecentQueueActivity({
  ownerTeam,
  rows
}: {
  ownerTeam: string | null;
  rows: QueueTableRow[];
}) {
  const lines = useMemo(() => {
    const scoped = ownerTeam ? rows.filter((row) => row.ownerTeam === ownerTeam) : rows;
    return scoped
      .slice(0, 5)
      .map((row) => `${row.ageLabel} · ${row.stage} · ${row.title.slice(0, 64)}`);
  }, [ownerTeam, rows]);

  if (!lines.length) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Recent queue activity
      </p>
      <ul className="mt-2 space-y-1.5">
        {lines.map((line) => (
          <li key={line} className="text-[12px] leading-snug text-slate-600">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function IncidentQueueWorkspace() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { ownerQueues, evidenceByAlias } = useGovernanceData();
  const scope = normalizeAiScope(params?.get("scope") ?? undefined);
  const scopeHref = useCallback(
    (path: string) => withAiScope(path, scope as AiScopeId),
    [scope]
  );

  const ownerParam = decodeOwner(params?.get("owner") ?? null);
  const queueParam = params?.get("queue");
  const isOwnerMode = queueParam === "owner" && Boolean(ownerParam);
  const incidentParam = params?.get("incident");

  const allRows = useMemo(() => {
    if (isOwnerMode && ownerParam) {
      return buildOwnerQueueRowsFromApi(
        ownerQueues[ownerParam] ?? null,
        evidenceByAlias,
        ownerParam
      );
    }
    return buildGlobalOwnerQueueRowsFromApi(ownerQueues, evidenceByAlias);
  }, [isOwnerMode, ownerParam, ownerQueues, evidenceByAlias]);

  useEffect(() => {
    if (incidentParam) return;
    const defaultRow = pickDefaultOwnerIncident(allRows);
    if (!defaultRow) return;
    if (isOwnerMode && ownerParam) {
      router.replace(
        scopeHref(routeToIncidentsOwnerQueue(ownerParam, defaultRow.incidentId)),
        { scroll: false }
      );
    } else {
      router.replace(
        scopeHref(routeToIncidentsQueue({ incidentId: defaultRow.incidentId })),
        { scroll: false }
      );
    }
  }, [isOwnerMode, ownerParam, incidentParam, router, scopeHref, allRows]);

  const filterOwnerFromUrl =
    !isOwnerMode && ownerParam && queueParam !== "owner" ? ownerParam : "All";

  return (
    <IncidentQueueWorkbench
      mode={isOwnerMode ? "owner" : "global"}
      lockedOwnerTeam={isOwnerMode ? ownerParam! : undefined}
      initialOwnerFilter={filterOwnerFromUrl}
      scopeHref={scopeHref}
      pathname={pathname}
      initialIncidentId={incidentParam}
    />
  );
}
