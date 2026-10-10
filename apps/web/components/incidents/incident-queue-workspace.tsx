"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { RiskTriageDrawer, type RiskDrawerTab } from "@/components/incidents/risk-detail-panel";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { normalizeAiScope, withAiScope, type AiScopeId } from "@/lib/ai-scope";
import { handoffIncidentToActionCenter } from "@/lib/governance-api";
import {
  buildGlobalOwnerQueueRowsFromApi,
  buildOwnerQueueRowsFromApi
} from "@/lib/governance-merge";
import {
  type OwnerReviewTableRow,
  type QueueTableRow
} from "@/lib/incident-queue-types";
import { primaryApiActions } from "@/lib/governance-actions-merge";
import { isDemoAgent } from "@/lib/governed-fleet-registry";
import { useGovernanceData } from "@/hooks/use-governance-data";
import { drawerTabForOverviewStep } from "@/lib/overview-summary";
import { categoryToOverviewKind, resolveIncidentLifecycle } from "@/lib/resolve-next-step";
import {
  routeToIncidentsOwnerQueue,
  routeToIncidentsQueue,
  routes
} from "@/lib/routes";

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

function severityBadgeTone(
  severity: string
): "critical" | "high" | "medium" | "low" {
  if (severity === "Critical") return "critical";
  if (severity === "High") return "high";
  if (severity === "Medium") return "medium";
  return "low";
}

function nextStepForRow(
  row: QueueTableRow,
  actions: ReturnType<typeof useGovernanceData>["actions"]
) {
  const linked =
    primaryApiActions(
      actions.filter(
        (a) =>
          a.alias_id === row.incidentId ||
          a.incident_id === row.incidentId ||
          a.incident_id === row.canonicalId
      )
    )[0] ?? null;
  return resolveIncidentLifecycle({
    openIncidents: 1,
    lifecycle: row.stage,
    actionStatus: linked?.status,
    verificationStatus: linked?.verification_status,
    resolutionStatus: linked?.resolution_status,
    actionId: linked?.id,
    incidentId: row.incidentId,
    severity: row.severityLabel,
    ownerTeam: row.ownerTeam ?? row.responderTeam,
    evidenceCount: row.evidenceItemsCount
  });
}

function drawerTabForRow(
  row: QueueTableRow,
  actions: ReturnType<typeof useGovernanceData>["actions"]
): RiskDrawerTab {
  return drawerTabForOverviewStep(
    categoryToOverviewKind(nextStepForRow(row, actions).category)
  );
}

export function IncidentQueueWorkspace() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const {
    ownerQueues,
    evidenceByAlias,
    actions,
    loading
  } = useGovernanceData();

  const scope = normalizeAiScope(params?.get("scope") ?? undefined);
  const scopeHref = useCallback(
    (path: string) => withAiScope(path, scope as AiScopeId),
    [scope]
  );

  const ownerParam = decodeOwner(params?.get("owner") ?? null);
  const queueParam = params?.get("queue");
  const isOwnerScoped = queueParam === "owner" && Boolean(ownerParam);
  const incidentParam = params?.get("incident");

  const allRows = useMemo((): QueueTableRow[] => {
    const rows =
      isOwnerScoped && ownerParam
        ? buildOwnerQueueRowsFromApi(
            ownerQueues[ownerParam] ?? null,
            evidenceByAlias,
            ownerParam
          )
        : buildGlobalOwnerQueueRowsFromApi(ownerQueues, evidenceByAlias);
    // Primary Risk Queue focuses on the 5-agent demo fleet. Keep a deep-linked
    // selected risk visible even if it somehow falls outside that set.
    return rows.filter(
      (row) =>
        isDemoAgent(row.systemCanonicalId) ||
        row.incidentId === incidentParam ||
        row.canonicalId === incidentParam
    );
  }, [isOwnerScoped, ownerParam, ownerQueues, evidenceByAlias, incidentParam]);

  const [stageFilter, setStageFilter] = useState("All");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [teamFilter, setTeamFilter] = useState("All");
  const [selectedId, setSelectedId] = useState<string | null>(incidentParam);
  const [drawerOpen, setDrawerOpen] = useState(Boolean(incidentParam));
  const [drawerTab, setDrawerTab] = useState<RiskDrawerTab>("decision");
  const dismissedIncident = useRef<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const teamOptions = useMemo(() => {
    return Array.from(
      new Set(
        allRows
          .map((row) => row.ownerTeam || row.responderTeam || "")
          .filter((team) => team.length > 0)
      )
    ).sort();
  }, [allRows]);

  const filteredRows = useMemo(() => {
    return allRows.filter((row) => {
      if (stageFilter !== "All" && row.stage !== stageFilter) return false;
      if (severityFilter !== "All" && row.severityLabel !== severityFilter) return false;
      const team = row.ownerTeam || row.responderTeam || "";
      if (teamFilter !== "All" && team !== teamFilter) return false;
      return true;
    });
  }, [allRows, stageFilter, severityFilter, teamFilter]);

  const syncUrl = useCallback(
    (incidentId: string | null) => {
      const qs = new URLSearchParams();
      if (isOwnerScoped && ownerParam) {
        qs.set("queue", "owner");
        qs.set("owner", ownerParam);
      }
      if (stageFilter !== "All") qs.set("stage", stageFilter);
      if (severityFilter !== "All") qs.set("severity", severityFilter);
      if (teamFilter !== "All") qs.set("team", teamFilter);
      if (incidentId) qs.set("incident", incidentId);
      const scopeQs = new URLSearchParams(window.location.search).get("scope");
      if (scopeQs) qs.set("scope", scopeQs);
      router.replace(qs.toString() ? `${pathname}?${qs.toString()}` : pathname, {
        scroll: false
      });
    },
    [
      router,
      pathname,
      isOwnerScoped,
      ownerParam,
      stageFilter,
      severityFilter,
      teamFilter
    ]
  );

  useEffect(() => {
    if (!filteredRows.length) {
      if (!loading) setSelectedId(null);
      return;
    }
    const stillVisible = filteredRows.some((r) => r.incidentId === selectedId);
    if (stillVisible) return;
    const preferred =
      (incidentParam &&
        filteredRows.find((r) => r.incidentId === incidentParam)) ||
      pickDefaultOwnerIncident(filteredRows);
    setSelectedId(preferred?.incidentId ?? null);
  }, [filteredRows, selectedId, incidentParam, loading]);

  useEffect(() => {
    syncUrl(selectedId);
  }, [selectedId, syncUrl]);

  const selectedRow = useMemo(
    () => filteredRows.find((r) => r.incidentId === selectedId) ?? null,
    [filteredRows, selectedId]
  );

  useEffect(() => {
    if (!selectedRow) return;
    setDrawerTab(drawerTabForRow(selectedRow, actions));
    // Tab follows the selected risk's current step, not live action polls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRow?.incidentId]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  };

  const clearOwnerScope = () => {
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

  const sendToActionCenter = async () => {
    if (!selectedRow) return;
    setSending(true);
    const ok = await handoffIncidentToActionCenter(selectedRow.incidentId);
    setSending(false);
    if (!ok) {
      showToast("Could not send to Action Center — check API connection");
      return;
    }
    showToast("Sent to Action Center");
  };

  return (
    <div className="space-y-5">
      <header className="space-y-3 border-b border-slate-100 pb-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Investigate · Runtime risks
          </p>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-slate-900">
            Risk Queue
          </h1>
          <p className="mt-1 text-[13px] text-slate-600">
            Active governance risks from correlated runtime signals. Select a risk to open triage.
          </p>
        </div>
        {isOwnerScoped && ownerParam ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-800">
              Filtered by team: {ownerParam}
              <button
                type="button"
                onClick={clearOwnerScope}
                className="rounded p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                aria-label="Clear team filter"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
            <p className="text-[11px] text-slate-500">
              Legacy deep link — showing risks for this responder team only.
            </p>
          </div>
        ) : null}
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="h-8 min-w-[140px] text-[11px]"
        >
          {STAGE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              Status: {s}
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
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          className="h-8 min-w-[160px] text-[11px]"
          aria-label="Team"
        >
          <option value="All">Team: All</option>
          {teamOptions.map((team) => (
            <option key={team} value={team}>
              Team: {team}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50/80 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Active risks · {filteredRows.length}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full divide-y divide-slate-200 text-[12px]">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-2 text-left font-medium">Risk</th>
                  <th className="px-2 py-2 text-left font-medium">Agent</th>
                  <th className="px-2 py-2 text-left font-medium">Diagnosis</th>
                  <th className="px-2 py-2 text-left font-medium">Severity</th>
                  <th className="px-2 py-2 text-left font-medium">Stage</th>
                  <th className="px-2 py-2 text-left font-medium">Next step</th>
                  <th className="px-2 py-2 text-left font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => {
                  const selected = row.incidentId === selectedId;
                  const step = nextStepForRow(row, actions);
                  return (
                    <tr
                      key={row.incidentId}
                      tabIndex={0}
                      role="button"
                      aria-selected={selected}
                      aria-label={`Review risk ${row.incidentId}`}
                      onClick={() => {
                        dismissedIncident.current = null;
                        setDrawerTab(drawerTabForRow(row, actions));
                        setSelectedId(row.incidentId);
                        setDrawerOpen(true);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          dismissedIncident.current = null;
                          setDrawerTab(drawerTabForRow(row, actions));
                          setSelectedId(row.incidentId);
                          setDrawerOpen(true);
                        }
                      }}
                      className={cn(
                        "cursor-pointer transition hover:bg-slate-50/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400",
                        selected && "border-l-2 border-l-slate-900 bg-slate-50"
                      )}
                    >
                      <td className="max-w-[160px] px-2 py-2">
                        <p className="font-semibold text-slate-900">{row.incidentId}</p>
                        <p className="truncate text-[11px] text-slate-500">{row.title}</p>
                        {row.metricName && row.latestObservedValue != null ? (
                          <p className="truncate text-[11px] text-slate-600">
                            {row.controlName ?? row.metricName.replace(/_/g, " ")}:{" "}
                            {row.latestObservedValue} observed
                            {row.thresholdValue != null ? ` vs ${row.thresholdValue} allowed` : ""}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 text-slate-700">
                        <span className="font-medium">{row.systemName}</span>
                        <span className="text-slate-400"> · </span>
                        <span className="tabular-nums text-slate-500">{row.systemId}</span>
                      </td>
                      <td className="max-w-[160px] px-2 py-2 text-[11px] text-slate-600">
                        {row.diagnosisLabel ?? row.riskCategory}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2">
                        <Badge tone={severityBadgeTone(row.severityLabel)} size="xs">
                          {row.severityLabel}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-slate-700">
                        {step.currentStageLabel}
                      </td>
                      <td className="max-w-[160px] px-2 py-2 text-[11px] text-slate-600">
                        {step.nextRequiredStep}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-[11px] font-semibold text-slate-800">
                        <button
                          type="button"
                          className="text-left underline decoration-slate-300 underline-offset-2 hover:text-slate-950"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (step.primaryDestination.surface === "risk_detail") {
                              dismissedIncident.current = null;
                              setDrawerTab(drawerTabForRow(row, actions));
                              setSelectedId(row.incidentId);
                              setDrawerOpen(true);
                              return;
                            }
                            router.push(scopeHref(step.primaryDestination.href));
                          }}
                        >
                          {step.primaryCtaLabel}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!loading && filteredRows.length === 0 ? (
            <div className="space-y-2 px-4 py-10 text-center">
              <p className="text-[13px] font-medium text-slate-800">
                No active runtime risks.
              </p>
              <p className="text-[12px] text-slate-500">
                Healthy telemetry stays in Runtime Monitor and does not open a risk until a
                control threshold is crossed.
              </p>
              <Link
                href={scopeHref(routes.liveSignals())}
                className="inline-flex text-[12px] font-semibold text-slate-800 underline underline-offset-2"
              >
                Inspect telemetry
              </Link>
            </div>
          ) : null}
          {loading && filteredRows.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-slate-500">
              Loading risks…
            </p>
          ) : null}
        </div>
      </div>

      <RiskTriageDrawer
        open={drawerOpen}
        row={selectedRow}
        evidence={selectedRow ? evidenceByAlias[selectedRow.incidentId] : null}
        actions={actions}
        scopeHref={scopeHref}
        sending={sending}
        onSendToActionCenter={() => void sendToActionCenter()}
        onToast={showToast}
        initialTab={drawerTab}
        onClose={() => {
          dismissedIncident.current = selectedRow?.incidentId ?? selectedId;
          setDrawerOpen(false);
        }}
      />

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

/** Keep owner-queue deep links resolving for legacy callers. */
export function routeOwnerQueueCompat(ownerTeam: string, incidentId?: string) {
  return routeToIncidentsOwnerQueue(ownerTeam, incidentId);
}
