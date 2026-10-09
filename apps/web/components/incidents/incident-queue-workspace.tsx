"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { RiskDetailPanel } from "@/components/incidents/risk-detail-panel";
import { Select } from "@/components/ui/select";
import { SummaryMini } from "@/components/ui/summary-mini";
import { cn } from "@/lib/cn";
import { normalizeAiScope, withAiScope, type AiScopeId } from "@/lib/ai-scope";
import { buildOwnerInsightsFromApi } from "@/lib/dashboard-merge";
import { handoffIncidentToActionCenter } from "@/lib/governance-api";
import {
  buildGlobalOwnerQueueRowsFromApi,
  buildOwnerQueueRowsFromApi
} from "@/lib/governance-merge";
import {
  PRIMARY_OWNER_QUEUE_TEAMS,
  type OwnerReviewTableRow,
  type QueueTableRow
} from "@/lib/incident-queue-types";
import { primaryApiActions } from "@/lib/governance-actions-merge";
import { isDemoAgent } from "@/lib/governed-fleet-registry";
import { useGovernanceData } from "@/hooks/use-governance-data";
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

function severityTextClass(severity: string): string {
  if (severity === "Critical" || severity === "High") return "text-rose-800";
  if (severity === "Medium") return "text-amber-800";
  return "text-emerald-800";
}

function actionHintForRow(
  row: QueueTableRow,
  actions: ReturnType<typeof useGovernanceData>["actions"]
): string {
  const linked =
    primaryApiActions(
      actions.filter(
        (a) =>
          a.alias_id === row.incidentId ||
          a.incident_id === row.incidentId ||
          a.incident_id === row.canonicalId
      )
    )[0] ?? null;
  if (!linked) return "Review governed action";
  const verification = linked.verification_status.toLowerCase();
  const status = linked.status.toLowerCase();
  if (verification.includes("rollback") || status.includes("rollback")) return "Review rollback path";
  if (verification.includes("no material") || verification.includes("follow")) return "Review follow-up";
  if (verification.includes("improvement")) return "View outcome";
  if (status.includes("awaiting")) return "Review decision";
  if (status.includes("approved") || verification.includes("monitor")) return "Verify impact";
  return linked.status;
}

export function IncidentQueueWorkspace() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const {
    ownerQueues,
    evidenceByAlias,
    dashboard,
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

  const ownerInsights = useMemo(
    () => buildOwnerInsightsFromApi(ownerQueues, dashboard),
    [ownerQueues, dashboard]
  );

  const [stageFilter, setStageFilter] = useState("All");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [selectedId, setSelectedId] = useState<string | null>(incidentParam);
  const [toast, setToast] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const filteredRows = useMemo(() => {
    return allRows.filter((row) => {
      if (stageFilter !== "All" && row.stage !== stageFilter) return false;
      if (severityFilter !== "All" && row.severityLabel !== severityFilter) return false;
      return true;
    });
  }, [allRows, stageFilter, severityFilter]);

  const syncUrl = useCallback(
    (incidentId: string | null) => {
      const qs = new URLSearchParams();
      if (isOwnerScoped && ownerParam) {
        qs.set("queue", "owner");
        qs.set("owner", ownerParam);
      }
      if (stageFilter !== "All") qs.set("stage", stageFilter);
      if (severityFilter !== "All") qs.set("severity", severityFilter);
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
      severityFilter
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

  const openCount = filteredRows.filter((r) => r.stage !== "Closed").length;
  const criticalCount = filteredRows.filter(
    (r) => r.severityLabel === "Critical" || r.severityLabel === "High"
  ).length;

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
            Active governance risks from correlated runtime signals — select a risk to review
            diagnosis, evidence, and next action.
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

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryMini label="Open risks" value={String(openCount)} />
        <SummaryMini label="Critical / high" value={String(criticalCount)} />
        <SummaryMini
          label="Decisions needed"
          value={String(dashboard?.decisions_needed ?? 0)}
        />
        <SummaryMini
          label="Teams with open risks"
          value={String(
            ownerInsights.filter((o) =>
              (PRIMARY_OWNER_QUEUE_TEAMS as readonly string[]).includes(o.ownerTeam)
            ).filter((o) => o.open > 0).length
          )}
        />
      </div>

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
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(300px,380px)]">
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
                  <th className="px-2 py-2 text-left font-medium">Status</th>
                  <th className="px-2 py-2 text-left font-medium">Updated</th>
                  <th className="px-2 py-2 text-left font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => {
                  const selected = row.incidentId === selectedId;
                  return (
                    <tr
                      key={row.incidentId}
                      tabIndex={0}
                      role="button"
                      aria-selected={selected}
                      aria-label={`Review risk ${row.incidentId}`}
                      onClick={() => setSelectedId(row.incidentId)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedId(row.incidentId);
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
                      <td
                        className={cn(
                          "whitespace-nowrap px-2 py-2 font-medium",
                          severityTextClass(row.severityLabel)
                        )}
                      >
                        {row.severityLabel}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-slate-700">
                        {row.stage}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-slate-500">
                        {row.updatedLabel ?? row.ageLabel}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-[11px] font-semibold text-slate-800">
                        {actionHintForRow(row, actions)}
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

        <aside className="rounded-lg border border-slate-200 bg-white shadow-sm lg:sticky lg:top-4 lg:self-start">
          {selectedRow ? (
            <RiskDetailPanel
              row={selectedRow}
              evidence={evidenceByAlias[selectedRow.incidentId]}
              actions={actions}
              scopeHref={scopeHref}
              onSendToActionCenter={sendToActionCenter}
              sending={sending}
            />
          ) : (
            <p className="p-4 text-[13px] text-slate-500">
              Select a risk to review diagnosis, evidence, and recommended action.
            </p>
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

/** Keep owner-queue deep links resolving for legacy callers. */
export function routeOwnerQueueCompat(ownerTeam: string, incidentId?: string) {
  return routeToIncidentsOwnerQueue(ownerTeam, incidentId);
}
