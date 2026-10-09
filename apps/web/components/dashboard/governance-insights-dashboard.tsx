"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronDown, PackageOpen } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { SummaryMini } from "@/components/ui/summary-mini";
import { GovernanceNotificationBell } from "@/components/fleetrac/governance-notification-bell";
import {
  buildGovernedSystemsFromApi,
  buildGovernanceLoopFromApi,
  buildOwnerInsightsFromApi,
  buildOwnerTeamDetailsFromApi,
  buildRemediationEvidenceSummaryFromApi,
  highestRiskOwnerTeamFromInsights
} from "@/lib/dashboard-merge";
import {
  buildGlobalOwnerQueueRowsFromApi,
  buildOwnerQueueRowsFromApi
} from "@/lib/governance-merge";
import { GovernanceLoopStatus } from "@/components/dashboard/governance-loop-status";
import { cn } from "@/lib/cn";
import { useGovernanceData } from "@/hooks/use-governance-data";
import {
  filterDemoAgents,
  flagshipRiskForSystem,
  GOVERNED_FLEET_SYSTEM_COUNT,
  isDemoAgent,
  sortDemoAgentsFirst
} from "@/lib/governed-fleet-registry";
import { primaryApiActions } from "@/lib/governance-actions-merge";
import {
  countDemoRisks,
  overviewNextStep,
  pickHighestPriorityModel,
  verificationResultCount,
  type OverviewNextStep
} from "@/lib/overview-summary";
import {
  DEFAULT_OWNER_TEAM,
  DEFAULT_SYSTEM_ID,
  formatRiskMixCompact,
  type GovernedSystem,
  type OwnerInsight,
  type OwnerTeamDetails
} from "@/lib/dashboard-types";
import { withAiScope, type AiScopeId } from "@/lib/ai-scope";
import {
  routeToEvidenceLibraryIncidentRecord,
  routeToEvidenceLibraryOwnerPackage,
  routeToIncident,
  routeToIncidentsOwnerQueue,
  routeToOutcomesOwnerEvidencePack,
  routes
} from "@/lib/routes";

function parseEvidenceAge(s: string): number {
  const m = String(s).match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

function statusRank(s: GovernedSystem["status"]): number {
  switch (s) {
    case "Critical":
      return 4;
    case "High":
      return 3;
    case "Medium":
      return 2;
    default:
      return 1;
  }
}

function compareSystems(a: GovernedSystem, b: GovernedSystem): number {
  const sr = statusRank(b.status) - statusRank(a.status);
  if (sr !== 0) return sr;
  const cr = b.criticalIncidents - a.criticalIncidents;
  if (cr !== 0) return cr;
  const ea = parseEvidenceAge(b.evidenceAge) - parseEvidenceAge(a.evidenceAge);
  if (ea !== 0) return ea;
  return b.openIncidents - a.openIncidents;
}

type TriageTone = "critical" | "high" | "medium" | "low" | "neutral" | "info";

const TRIAGE_BADGE: Record<TriageTone, string> = {
  critical: "bg-red-50 text-red-700 ring-1 ring-red-200",
  high: "bg-orange-50 text-orange-800 ring-1 ring-orange-200",
  medium: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  low: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  neutral: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  info: "bg-sky-50 text-sky-800 ring-1 ring-sky-200"
};

const TRIAGE_BORDER: Record<TriageTone, string> = {
  critical: "border-l-red-500",
  high: "border-l-orange-400",
  medium: "border-l-amber-400",
  low: "border-l-emerald-500",
  neutral: "border-l-slate-300",
  info: "border-l-sky-500"
};

const SELECTED_ROW = "bg-indigo-50/70";
const SELECTED_ACCENT = "absolute left-0 top-0 h-full w-0.5 bg-indigo-500";

function triageTone(value: string | null | undefined): TriageTone {
  const s = (value ?? "").toLowerCase();
  if (s === "critical") return "critical";
  if (s === "high") return "high";
  if (s === "medium") return "medium";
  if (s === "low" || s === "healthy") return "low";
  return "neutral";
}

function slaBadgeTone(sla: import("@/lib/dashboard-types").SlaRiskLevel): TriageTone {
  if (sla === "High") return "high";
  if (sla === "Medium") return "medium";
  return "low";
}

function handoffTone(status: string): TriageTone {
  if (status === "Notified") return "info";
  if (status === "Pending") return "medium";
  return "neutral";
}

function bottleneckTone(label: string): TriageTone {
  const s = label.toLowerCase();
  if (!s || s.includes("monitor") || s.includes("closed")) return "neutral";
  if (s.includes("verif") || s.includes("remediat")) return "info";
  return "medium";
}

function stepBadgeTone(kind: OverviewNextStep["kind"]): TriageTone {
  if (kind === "monitoring") return "neutral";
  if (kind === "verify" || kind === "outcome") return "info";
  return "medium";
}

function TriageBadge({
  children,
  tone
}: {
  children: string | number;
  tone: TriageTone;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
        TRIAGE_BADGE[tone]
      )}
    >
      {children}
    </span>
  );
}

export function GovernanceInsightsDashboard({ scope }: { scope: AiScopeId }) {
  const router = useRouter();
  const scopeHref = (path: string) => withAiScope(path, scope);
  const [selectedOwnerTeam, setSelectedOwnerTeam] = useState(DEFAULT_OWNER_TEAM);
  const [selectedSystemId, setSelectedSystemId] = useState(DEFAULT_SYSTEM_ID);
  const [filters, setFilters] = useState({
    ownerTeam: DEFAULT_OWNER_TEAM,
    riskCategory: "",
    severity: ""
  });

  const evidencePanelRef = useRef<HTMLDivElement | null>(null);

  const [dashboardToast, setDashboardToast] = useState<string | null>(null);
  const {
    dashboard: apiDashboard,
    ownerQueues,
    evidenceByAlias,
    governanceSystems,
    actions: apiActions
  } = useGovernanceData();

  const ownerInsights = useMemo(
    () => buildOwnerInsightsFromApi(ownerQueues, apiDashboard),
    [ownerQueues, apiDashboard]
  );

  const governedSystems = useMemo(() => {
    const scopedApi = governanceSystems
      ? {
          ...governanceSystems,
          items: sortDemoAgentsFirst(filterDemoAgents(governanceSystems.items)),
          total: GOVERNED_FLEET_SYSTEM_COUNT
        }
      : null;
    return buildGovernedSystemsFromApi(scopedApi, ownerQueues).filter((sys) =>
      isDemoAgent(sys.systemId)
    );
  }, [governanceSystems, ownerQueues]);

  const remediationSummary = useMemo(
    () => buildRemediationEvidenceSummaryFromApi(apiDashboard),
    [apiDashboard]
  );

  const kpi = useMemo(() => {
    const queueRisks = Object.values(ownerQueues).flatMap((queue) =>
      (queue?.items ?? []).map((row) => ({
        systemId: row.system_id,
        severity: row.severity,
        lifecycle: row.lifecycle
      }))
    );
    const demoCounts = countDemoRisks(queueRisks, isDemoAgent);
    const usingQueues = Object.values(ownerQueues).some((queue) => queue != null);
    const active = usingQueues ? demoCounts.active : (apiDashboard?.active_incidents ?? 0);
    const criticalHigh = usingQueues
      ? demoCounts.criticalHigh
      : (apiDashboard?.critical_incidents ?? 0);
    const verification = verificationResultCount({
      improved: apiDashboard?.verification_improved,
      followUp: apiDashboard?.verification_follow_up,
      rollback: apiDashboard?.verification_rollback
    });
    return {
      governedAgents: governedSystems.length || GOVERNED_FLEET_SYSTEM_COUNT,
      active,
      criticalHigh,
      awaitingDecision: apiDashboard?.actions_awaiting_approval ?? 0,
      verification
    };
  }, [apiDashboard, ownerQueues, governedSystems.length]);

  const loopMetrics = useMemo(
    () => buildGovernanceLoopFromApi(apiDashboard),
    [apiDashboard]
  );

  const headerPosture = useMemo(
    () => ({
      governedAgents: kpi.governedAgents,
      active: kpi.active,
      awaitingDecision: kpi.awaitingDecision,
      verification: kpi.verification
    }),
    [kpi]
  );

  const filteredSystems = useMemo(() => {
    return governedSystems.filter((sys) => {
      if (filters.ownerTeam && sys.ownerTeam !== filters.ownerTeam) return false;
      if (filters.riskCategory && sys.primaryRisk !== filters.riskCategory) return false;
      if (filters.severity && sys.status !== filters.severity) return false;
      return true;
    }).sort(compareSystems);
  }, [filters, governedSystems]);

  const userPickedModel = useRef(false);
  useEffect(() => {
    if (governedSystems.length === 0) return;
    const visible = filteredSystems.length > 0 ? filteredSystems : governedSystems;
    const selectionVisible = visible.some((sys) => sys.id === selectedSystemId);
    if (userPickedModel.current && selectionVisible) return;

    const top = userPickedModel.current
      ? pickHighestPriorityModel(visible)
      : pickHighestPriorityModel(governedSystems);
    if (!top || top.id === selectedSystemId) return;

    setSelectedSystemId(top.id);
    setSelectedOwnerTeam(top.ownerTeam);
    if (!userPickedModel.current) {
      setFilters((current) =>
        current.ownerTeam === top.ownerTeam ? current : { ...current, ownerTeam: top.ownerTeam }
      );
    }
  }, [governedSystems, filteredSystems, selectedSystemId]);

  const selectedSystem = useMemo(
    () => governedSystems.find((s) => s.id === selectedSystemId) ?? governedSystems[0],
    [selectedSystemId, governedSystems]
  );

  const ownerInsightRow = useMemo(
    () => ownerInsights.find((o) => o.ownerTeam === selectedOwnerTeam) ?? ownerInsights[0],
    [selectedOwnerTeam, ownerInsights]
  );

  const primaryActions = useMemo(() => primaryApiActions(apiActions), [apiActions]);

  const ownerQueueRows = useMemo(
    () =>
      buildOwnerQueueRowsFromApi(
        ownerQueues[selectedOwnerTeam],
        evidenceByAlias,
        selectedOwnerTeam
      ),
    [selectedOwnerTeam, ownerQueues, evidenceByAlias]
  );

  const priorityRisk = useMemo(() => {
    if (ownerQueueRows.length === 0) return null;
    const forSelected = selectedSystem
      ? ownerQueueRows.find(
          (row) =>
            row.systemId === selectedSystem.id ||
            row.systemCanonicalId === selectedSystem.systemId
        )
      : undefined;
    return forSelected ?? ownerQueueRows[0];
  }, [ownerQueueRows, selectedSystem]);

  const activeOwnerTeamDetails = useMemo((): OwnerTeamDetails => {
    return buildOwnerTeamDetailsFromApi(selectedOwnerTeam, ownerQueues, ownerInsights);
  }, [selectedOwnerTeam, ownerQueues, ownerInsights]);

  const clearOwnerFilter = useCallback(() => {
    const fleetOwner = highestRiskOwnerTeamFromInsights(ownerInsights);
    setFilters((f) => ({ ...f, ownerTeam: "" }));
    const fullSorted = [...governedSystems].sort(compareSystems);
    const stillVisible = fullSorted.some((s) => s.id === selectedSystemId);
    if (stillVisible) {
      setSelectedOwnerTeam(fleetOwner);
    } else if (fullSorted[0]) {
      setSelectedSystemId(fullSorted[0].id);
      setSelectedOwnerTeam(fullSorted[0].ownerTeam);
    }
  }, [selectedSystemId, governedSystems]);

  const onOwnerTeamFilterChange = useCallback(
    (ownerTeam: string) => {
      if (ownerTeam) {
        setFilters((f) => ({ ...f, ownerTeam: ownerTeam }));
        setSelectedOwnerTeam(ownerTeam);
      } else {
        clearOwnerFilter();
      }
    },
    [clearOwnerFilter]
  );

  const onOwnerRowClick = (row: OwnerInsight) => {
    setSelectedOwnerTeam(row.ownerTeam);
    setFilters((f) => ({ ...f, ownerTeam: row.ownerTeam }));
    window.requestAnimationFrame(() => {
      evidencePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  const focusOwnerFromSystem = useCallback((sys: GovernedSystem) => {
    userPickedModel.current = true;
    setSelectedSystemId(sys.id);
    setSelectedOwnerTeam(sys.ownerTeam);
    setFilters((f) => ({
      ...f,
      ownerTeam: f.ownerTeam && f.ownerTeam !== sys.ownerTeam ? "" : f.ownerTeam
    }));
    window.requestAnimationFrame(() => {
      evidencePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, []);

  const onSystemRowClick = (sys: GovernedSystem) => {
    focusOwnerFromSystem(sys);
  };

  const openRelatedRisk = useCallback(
    (systemId: string, incidentId?: string | null) => {
      const alias =
        incidentId ||
        flagshipRiskForSystem(systemId) ||
        null;
      if (alias) {
        router.push(scopeHref(routeToIncident(alias)));
        return;
      }
      const sys = governedSystems.find((s) => s.id === systemId);
      if (sys) {
        router.push(scopeHref(routeToIncidentsOwnerQueue(sys.ownerTeam)));
      }
    },
    [governedSystems, router, scopeHref]
  );

  const onPrioritySystemClick = (systemId: string, incidentId?: string) => {
    openRelatedRisk(systemId, incidentId);
  };

  const reviewOwnerQueue = useCallback(() => {
    const team = highestRiskOwnerTeamFromInsights(ownerInsights);
    router.push(scopeHref(routeToIncidentsOwnerQueue(team)));
  }, [ownerInsights, router, scopeHref]);

  const selectedFlagshipRisk = flagshipRiskForSystem(
    selectedSystem?.systemId ?? selectedSystemId
  );

  const stepForRisk = useCallback(
    (
      risk: {
        incidentId: string;
        systemCanonicalId?: string;
        stage: string;
      } | null,
      openIncidents: number
    ): OverviewNextStep => {
      const action = risk
        ? primaryActions.find(
            (row) =>
              row.alias_id === risk.incidentId || row.incident_id === risk.incidentId
          ) ??
          primaryActions.find((row) => row.system_id === risk.systemCanonicalId)
        : undefined;
      return overviewNextStep({
        openIncidents,
        lifecycle: risk?.stage,
        actionStatus: action?.status,
        verificationStatus: action?.verification_status,
        incidentId: risk?.incidentId,
        bottleneck: ownerInsightRow?.bottleneck
      });
    },
    [primaryActions, ownerInsightRow?.bottleneck]
  );

  const priorityStep = stepForRisk(
    priorityRisk,
    priorityRisk ? 1 : ownerInsightRow?.open ?? 0
  );

  const hrefForStep = useCallback(
    (step: OverviewNextStep, incidentId?: string | null, actionId?: string | null) => {
      if (step.kind === "governed_action") {
        return scopeHref(
          actionId ? `${routes.actions()}?action=${encodeURIComponent(actionId)}` : routes.actions()
        );
      }
      if (step.kind === "verify" && actionId) {
        return scopeHref(
          `${routes.actions()}?tab=ready&action=${encodeURIComponent(actionId)}`
        );
      }
      if ((step.kind === "rollback" || step.kind === "follow_up") && actionId) {
        return scopeHref(
          `${routes.actions()}?tab=closed&action=${encodeURIComponent(actionId)}`
        );
      }
      if (step.kind === "outcome" && incidentId) {
        return scopeHref(routeToEvidenceLibraryIncidentRecord(incidentId, selectedOwnerTeam));
      }
      if (step.kind === "monitoring") return scopeHref(routes.liveSignals());
      if (incidentId) return scopeHref(routeToIncident(incidentId));
      return scopeHref(routeToIncidentsOwnerQueue(selectedOwnerTeam));
    },
    [scopeHref, selectedOwnerTeam]
  );

  const allQueueRows = useMemo(
    () => buildGlobalOwnerQueueRowsFromApi(ownerQueues, evidenceByAlias),
    [ownerQueues, evidenceByAlias]
  );

  const filteredActiveRisks = filteredSystems.reduce(
    (sum, sys) => sum + sys.openIncidents,
    0
  );
  const filteredCritical = filteredSystems.reduce(
    (sum, sys) => sum + sys.criticalIncidents,
    0
  );

  const selectedSystemRisk = selectedSystem
    ? allQueueRows.find(
        (row) =>
          row.systemId === selectedSystem.id ||
          row.systemCanonicalId === selectedSystem.systemId
      )
    : undefined;

  const selectedSystemStep = stepForRisk(
    selectedSystemRisk
      ? {
          incidentId: selectedSystemRisk.incidentId,
          systemCanonicalId: selectedSystemRisk.systemCanonicalId,
          stage: selectedSystemRisk.stage
        }
      : null,
    selectedSystem?.openIncidents ?? 0
  );

  const priorityActionId = priorityRisk
    ? primaryActions.find(
        (row) =>
          row.alias_id === priorityRisk.incidentId ||
          row.incident_id === priorityRisk.incidentId
      )?.id
    : undefined;

  const ownerTeams = useMemo(
    () => Array.from(new Set(governedSystems.map((s) => s.ownerTeam))).sort(),
    [governedSystems]
  );

  const showDashboardToast = useCallback((msg: string) => {
    setDashboardToast(msg);
    window.setTimeout(() => setDashboardToast(null), 3000);
  }, []);

  const openOwnerEvidencePack = useCallback(() => {
    router.push(scopeHref(routeToOutcomesOwnerEvidencePack(selectedOwnerTeam)));
  }, [selectedOwnerTeam, router, scopeHref]);

  const notifyOwnerLead = useCallback(() => {
    showDashboardToast("Owner notification recorded via governance API");
  }, [showDashboardToast]);

  const evidencePackButtonLabel =
    activeOwnerTeamDetails.evidencePackStatus === "Not generated"
      ? "Prepare outcome evidence"
      : "View outcome evidence";

  return (
    <section className="space-y-10 pb-8">
      {/* Header */}
      <header className="flex flex-col gap-4 border-b border-slate-100 pb-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Orient · Runtime agent governance
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-[26px]">
            Overview
          </h1>
          <div className="flex max-w-3xl flex-wrap gap-1.5 pt-1">
            <SummaryMini
              compact
              label="Governed agents"
              value={String(headerPosture.governedAgents)}
            />
            <SummaryMini
              compact
              label="Active risks"
              value={String(headerPosture.active)}
            />
            <SummaryMini
              compact
              label="Awaiting decision"
              value={String(headerPosture.awaitingDecision)}
            />
            <SummaryMini
              compact
              label="Verification results"
              value={String(headerPosture.verification)}
            />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <GovernanceNotificationBell scopeHref={scopeHref} />
          <button
            type="button"
            onClick={reviewOwnerQueue}
            className="inline-flex items-center gap-2 rounded-md border border-slate-900 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            Open risk queue
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
          {selectedFlagshipRisk ? (
            <Link
              href={scopeHref(routeToIncident(selectedFlagshipRisk))}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300"
            >
              Review model risk
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : null}
        </div>
      </header>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiGovernance
          label="Governed agents"
          value={kpi.governedAgents}
          caption="Demo fleet in the primary workflow"
          accent="slate"
        />
        <KpiGovernance
          label="Active risks"
          value={kpi.active}
          caption={`${kpi.criticalHigh} critical or high`}
          accent="rose"
        />
        <KpiGovernance
          label="Awaiting decision"
          value={kpi.awaitingDecision}
          caption="Governed actions not yet approved"
          accent="amber"
        />
        <KpiGovernance
          label="Critical / high risks"
          value={kpi.criticalHigh}
          caption="Same demo agents as the Risk Queue"
          accent="rose"
        />
        <KpiGovernance
          label="Verification results"
          value={kpi.verification}
          caption="Improved, follow-up, and rollback"
          accent="emerald"
        />
      </div>

      {/* Main workspace — fixed viewport band; inner panels scroll */}
      <div className="grid min-h-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.62fr)_minmax(0,1fr)] xl:items-stretch">
        {/* Risk ownership */}
        <Card className="flex min-h-0 max-h-[min(520px,56vh)] flex-col overflow-hidden shadow-none">
          <div className="shrink-0 border-b border-slate-100 pb-3">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold tracking-tight text-slate-900">
                Risk Ownership Insights
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Select an owner to see accountable risk, priority systems, and next actions.
              </p>
            </div>
          </div>
            <div className="min-h-0 flex-1 overflow-auto px-1 pb-3 pt-1 [-webkit-overflow-scrolling:touch]">
            <table className="w-full min-w-[780px] border-collapse text-left text-[13px]">
              <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_rgb(226_232_240)]">
                <tr className="border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">Owner Team</th>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">Handoff</th>
                  <th className="px-3 py-2 text-right font-semibold">Open</th>
                  <th className="px-3 py-2 text-right font-semibold">Critical</th>
                  <th className="min-w-[130px] px-3 py-2 font-semibold">Risk mix</th>
                  <th className="min-w-[112px] px-3 py-2 font-semibold">Bottleneck</th>
                  <th className="px-3 py-2 font-semibold">SLA Risk</th>
                  <th className="min-w-[128px] px-3 py-2 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {ownerInsights.map((row) => {
                  const ownerStatus = buildOwnerTeamDetailsFromApi(
                    row.ownerTeam,
                    ownerQueues,
                    ownerInsights
                  ).notificationStatus;
                  const selected = selectedOwnerTeam === row.ownerTeam;
                  return (
                    <tr
                      key={row.ownerTeam}
                      role="button"
                      tabIndex={0}
                      onClick={() => onOwnerRowClick(row)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") onOwnerRowClick(row);
                      }}
                      className={cn(
                        "cursor-pointer border-b border-slate-100 bg-white transition-colors last:border-b-0",
                        selected ? SELECTED_ROW : "hover:bg-slate-50"
                      )}
                    >
                      <td className="relative px-3 py-2.5 font-medium text-slate-900">
                        {selected ? <span className={SELECTED_ACCENT} aria-hidden /> : null}
                        <span className="pl-0">{row.ownerTeam}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <TriageBadge tone={handoffTone(ownerStatus)}>{ownerStatus}</TriageBadge>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                        {row.open}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {row.critical > 0 ? (
                          <TriageBadge tone="critical">{row.critical}</TriageBadge>
                        ) : (
                          <span className="tabular-nums text-slate-400">0</span>
                        )}
                      </td>
                      <td className="max-w-[200px] px-3 py-2.5 text-[11px] leading-snug text-slate-500">
                        {formatRiskMixCompact(row)}
                      </td>
                      <td className="px-3 py-2.5">
                        <TriageBadge tone={bottleneckTone(row.bottleneck)}>
                          {row.bottleneck}
                        </TriageBadge>
                      </td>
                      <td className="px-3 py-2.5">
                        <TriageBadge tone={slaBadgeTone(row.slaRisk)}>{row.slaRisk}</TriageBadge>
                      </td>
                      <td className="min-w-[128px] px-3 py-2.5 text-[11px] leading-tight text-slate-700">
                        {row.nextAction}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Evidence panel */}
        <div
          ref={evidencePanelRef}
          id="dashboard-evidence-panel"
          className="flex min-h-0 max-h-[min(520px,56vh)] flex-col"
        >
          <Card className="flex h-full min-h-0 flex-1 flex-col overflow-hidden border-slate-200 bg-white shadow-none ring-1 ring-slate-100">
            <>
                <div className="shrink-0 border-b border-slate-100 px-4 pb-3 pt-4">
                  <CardHeader
                    title="Owner Action Panel"
                    action={
                      <OwnerPivotToolbar
                        details={activeOwnerTeamDetails}
                        onEvidencePrimary={openOwnerEvidencePack}
                        evidencePrimaryLabel={evidencePackButtonLabel}
                      />
                    }
                  />
                  <p className="mt-1 text-[12px] font-medium text-slate-700">
                    {selectedOwnerTeam}
                    <span className="font-normal text-slate-500">
                      {" "}
                      · {ownerInsightRow.open} open · {ownerInsightRow.critical} critical
                    </span>
                  </p>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-3">
                  <div className="space-y-3">
                    <section
                      className={cn(
                        "rounded-md border border-slate-200 bg-white px-3 py-2.5",
                        priorityRisk && "border-l-2",
                        priorityRisk && TRIAGE_BORDER[triageTone(priorityRisk.severityLabel)]
                      )}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        What broke
                      </p>
                      {priorityRisk ? (
                        <>
                          <p className="mt-1 text-[13px] font-semibold leading-snug text-slate-900">
                            {priorityRisk.title}
                          </p>
                          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] leading-snug text-slate-600">
                            <span>{priorityRisk.systemName}</span>
                            <span className="text-slate-300">·</span>
                            <span>{priorityRisk.riskCategory}</span>
                            <TriageBadge tone={triageTone(priorityRisk.severityLabel)}>
                              {priorityRisk.severityLabel}
                            </TriageBadge>
                          </p>
                        </>
                      ) : (
                        <p className="mt-1 text-[13px] leading-snug text-slate-700">
                          No open risk for this owner.
                        </p>
                      )}
                    </section>

                    <section className="rounded-md border border-slate-200 bg-white px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Current step
                      </p>
                      <p className="mt-1">
                        <TriageBadge tone={stepBadgeTone(priorityStep.kind)}>
                          {priorityStep.step}
                        </TriageBadge>
                      </p>
                      <div className="mt-2">
                        <GovernanceLoopStatus
                          compact
                          variant="owner"
                          currentStage={ownerInsightRow.governanceStage}
                          stageSummary={`${ownerInsightRow.open} open · ${ownerInsightRow.critical} critical`}
                        />
                      </div>
                    </section>

                    <section className="rounded-md border border-slate-200 bg-white px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Next action
                      </p>
                      <p className="mt-1 text-[12px] leading-snug text-slate-600">
                        {priorityStep.detail}
                      </p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                        {priorityStep.kind === "monitoring" ? (
                          <Link
                            href={hrefForStep(priorityStep)}
                            className="inline-flex items-center rounded-md bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-slate-800"
                          >
                            Inspect runtime signals →
                          </Link>
                        ) : (
                          <Link
                            href={hrefForStep(
                              priorityStep,
                              priorityRisk?.incidentId,
                              priorityActionId
                            )}
                            className="inline-flex items-center rounded-md bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-slate-800"
                          >
                            {priorityStep.label} →
                          </Link>
                        )}
                        {priorityRisk && priorityStep.kind !== "risk_detail" ? (
                          <Link
                            href={scopeHref(routeToIncident(priorityRisk.incidentId))}
                            className="text-[12px] font-semibold text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                          >
                            Open risk detail
                          </Link>
                        ) : null}
                        {activeOwnerTeamDetails.notificationStatus === "Pending" ? (
                          <button
                            type="button"
                            onClick={notifyOwnerLead}
                            className="text-[12px] font-semibold text-amber-800 underline decoration-amber-200 underline-offset-2 hover:text-amber-950"
                          >
                            Notify owner
                          </button>
                        ) : null}
                      </div>
                    </section>

                    {ownerQueueRows.length > 0 ? (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          Agents needing attention
                        </p>
                        <ul className="mt-1 divide-y divide-slate-100">
                          {ownerQueueRows.slice(0, 4).map((row) => {
                            const step = stepForRisk(row, 1);
                            const attentionSelected =
                              row.systemId === selectedSystemId ||
                              row.systemCanonicalId === selectedSystem?.systemId;
                            return (
                              <li key={row.incidentId}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onPrioritySystemClick(row.systemId, row.incidentId)
                                  }
                                  className={cn(
                                    "relative w-full cursor-pointer py-2 pl-2 text-left transition",
                                    attentionSelected ? SELECTED_ROW : "hover:bg-slate-50"
                                  )}
                                >
                                  {attentionSelected ? (
                                    <span className={SELECTED_ACCENT} aria-hidden />
                                  ) : null}
                                  <p className="flex flex-wrap items-center gap-x-2 text-[12px] font-semibold leading-snug text-slate-900">
                                    <span>{row.systemName}</span>
                                    <TriageBadge tone={triageTone(row.severityLabel)}>
                                      {row.severityLabel}
                                    </TriageBadge>
                                  </p>
                                  <p className="mt-0.5 text-[11px] text-slate-600">
                                    {row.incidentId} · {step.label}
                                  </p>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
          </Card>
        </div>
      </div>

      {/* Systems table */}
      <Card className="overflow-hidden shadow-none ring-1 ring-slate-100">
        <div className="border-b border-slate-100 px-4 py-4">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            Agents requiring governance action
          </h2>
          <p className="mt-1 text-[13px] text-slate-600">
            {filters.ownerTeam || "All owners"}
            {" · "}
            {filteredSystems.length} governed{" "}
            {filteredSystems.length === 1 ? "agent" : "agents"}
            {" · "}
            {filteredActiveRisks} active {filteredActiveRisks === 1 ? "risk" : "risks"}
            {" · "}
            {filteredCritical} critical
          </p>
          {selectedSystem ? (
            <p className="mt-2 text-[12px] leading-snug text-slate-600">
              <span className="font-semibold text-slate-900">{selectedSystem.name}</span>
              <span className="text-slate-300"> · </span>
              {selectedSystem.status} posture
              <span className="text-slate-300"> · </span>
              {selectedSystem.openIncidents} open
              <span className="text-slate-300"> · </span>
              Next: {selectedSystemStep.label}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <FilterSelect
              label="Owner Team"
              value={filters.ownerTeam}
              onChange={onOwnerTeamFilterChange}
              options={["", ...ownerTeams]}
              format={(v) => v || "All"}
            />
            <FilterSelect
              label="Risk Category"
              value={filters.riskCategory}
              onChange={(v) => setFilters((f) => ({ ...f, riskCategory: v }))}
              options={["", "Technology Risk", "Output Reliability", "Cyber Risk", "Governance"]}
              format={(v) => v || "All"}
            />
            <FilterSelect
              label="Severity"
              value={filters.severity}
              onChange={(v) => setFilters((f) => ({ ...f, severity: v }))}
              options={["", "Critical", "High", "Medium", "Low"]}
              format={(v) => v || "All"}
            />
            {filters.ownerTeam ? (
              <FilterChip
                label={`Owner: ${filters.ownerTeam}`}
                onClear={clearOwnerFilter}
              />
            ) : null}
            {filters.riskCategory ? (
              <FilterChip
                label={`Risk: ${filters.riskCategory}`}
                onClear={() => setFilters((f) => ({ ...f, riskCategory: "" }))}
              />
            ) : null}
            {filters.severity ? (
              <FilterChip
                label={`Severity: ${filters.severity}`}
                onClear={() => setFilters((f) => ({ ...f, severity: "" }))}
              />
            ) : null}
          </div>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2.5 text-left">Agent</th>
                  <th className="px-3 py-2.5 text-left">Type</th>
                  <th className="px-3 py-2.5 text-left">Platform</th>
                  <th className="px-3 py-2.5 text-left">Owner</th>
                  <th className="px-3 py-2.5 text-left">Primary Risk</th>
                  <th className="px-3 py-2.5 text-left">Posture</th>
                  <th className="px-3 py-2.5 text-right">Open</th>
                  <th className="px-3 py-2.5 text-right">Critical</th>
                  <th className="px-3 py-2.5 text-left">Last evidence</th>
                  <th className="px-3 py-2.5 text-left">Next step</th>
                </tr>
              </thead>
              <tbody>
                {filteredSystems.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-[13px] text-slate-500">
                      No agents match these filters. Clear a filter to see the governed fleet.
                    </td>
                  </tr>
                ) : null}
                {filteredSystems.map((sys) => {
                  const sel =
                    sys.ownerTeam === selectedOwnerTeam && sys.id === selectedSystemId;
                  return (
                    <tr
                      key={sys.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onSystemRowClick(sys)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") onSystemRowClick(sys);
                      }}
                      className={cn(
                        "cursor-pointer border-b border-slate-100 bg-white transition-colors last:border-b-0",
                        sel ? SELECTED_ROW : "hover:bg-slate-50"
                      )}
                    >
                      <td className="relative px-3 py-2.5">
                        {sel ? <span className={SELECTED_ACCENT} aria-hidden /> : null}
                        <span className="font-medium text-slate-900">{sys.name}</span>
                        <span className="ml-1.5 font-mono text-[11px] text-slate-400">{sys.id}</span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">{sys.type}</td>
                      <td className="px-3 py-2.5 text-slate-700">{sys.platform}</td>
                      <td className="px-3 py-2.5 text-slate-700">{sys.ownerTeam}</td>
                      <td className="px-3 py-2.5 text-slate-700">{sys.primaryRisk}</td>
                      <td className="px-3 py-2.5">
                        <TriageBadge tone={triageTone(sys.status)}>{sys.status}</TriageBadge>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                        {sys.openIncidents}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {sys.criticalIncidents > 0 ? (
                          <TriageBadge tone="critical">{sys.criticalIncidents}</TriageBadge>
                        ) : (
                          <span className="tabular-nums text-slate-400">0</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-slate-700">{sys.evidenceAge}</td>
                      <td className="px-3 py-2.5 text-[12px] font-medium text-slate-800">
                        {(() => {
                          const risk = allQueueRows.find(
                            (row) =>
                              row.systemId === sys.id ||
                              row.systemCanonicalId === sys.systemId
                          );
                          const step = stepForRisk(
                            risk
                              ? {
                                  incidentId: risk.incidentId,
                                  systemCanonicalId: risk.systemCanonicalId,
                                  stage: risk.stage
                                }
                              : sys.openIncidents > 0 && flagshipRiskForSystem(sys.systemId)
                                ? {
                                    incidentId: flagshipRiskForSystem(sys.systemId) ?? "",
                                    systemCanonicalId: sys.systemId,
                                    stage: ""
                                  }
                                : null,
                            sys.openIncidents
                          );
                          const actionId = risk
                            ? primaryActions.find(
                                (row) =>
                                  row.alias_id === risk.incidentId ||
                                  row.incident_id === risk.incidentId
                              )?.id
                            : undefined;
                          if (step.kind === "monitoring") {
                            return <span className="font-medium text-slate-500">Monitoring</span>;
                          }
                          return (
                            <Link
                              href={hrefForStep(step, risk?.incidentId ?? flagshipRiskForSystem(sys.systemId), actionId)}
                              onClick={(e) => e.stopPropagation()}
                              className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-2 hover:text-indigo-800"
                            >
                              {step.label}
                            </Link>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
      </Card>

      {/* Operational metrics — single scan-friendly snapshot */}
      <section aria-labelledby="dashboard-operational-metrics-heading" className="space-y-2">
        <h2
          id="dashboard-operational-metrics-heading"
          className="text-sm font-semibold tracking-tight text-slate-900"
        >
          Operational metrics
        </h2>
        <p id="dashboard-operational-metrics-desc" className="sr-only">
          Investigation counts, post-remediation verification, and rolling remediation evidence. Each band links to the relevant workspace.
        </p>
        <Card
          className="shadow-none ring-1 ring-slate-100"
          aria-describedby="dashboard-operational-metrics-desc"
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-6">
              <div className="min-w-0 flex-1">
                <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Incident workflow
                </h3>
                <OperationalMetricGrid
                  columns={4}
                  items={[
                    { label: "Active risks", value: loopMetrics.investigations.open },
                    {
                      label: "Awaiting approval",
                      value: loopMetrics.investigations.awaitingApproval
                    },
                    {
                      label: "Pending recommendations",
                      value: loopMetrics.investigations.pendingRecommendations
                    },
                    { label: "Recurring patterns", value: loopMetrics.investigations.recurring }
                  ]}
                />
              </div>
              <Link
                href={scopeHref(routeToIncidentsOwnerQueue(selectedOwnerTeam))}
                className="shrink-0 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                Review risk queue →
              </Link>
            </div>
          </div>

          <div className="border-b border-slate-100 px-4 py-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-6">
              <div className="min-w-0 flex-1">
                <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Verification
                </h3>
                <OperationalMetricGrid
                  columns={4}
                  items={[
                    {
                      label: "Recurrence reduced",
                      value: loopMetrics.verification.recurrenceReduced,
                      variant: "emerald"
                    },
                    {
                      label: "Improvement observed",
                      value: loopMetrics.verification.improvement,
                      variant: "default"
                    },
                    {
                      label: "Follow-up required",
                      value: loopMetrics.verification.followUp,
                      variant: "amber"
                    },
                    {
                      label: "Rollback candidates",
                      value: loopMetrics.verification.rollback,
                      variant: "rose"
                    }
                  ]}
                />
              </div>
              <Link
                href={scopeHref(routes.outcomes())}
                className="shrink-0 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                View outcome evidence →
              </Link>
            </div>
          </div>

          <div className="px-4 py-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-6">
              <div className="min-w-0 flex-1">
                <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Remediation evidence
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-500">Rolling 30-day control impact</p>
                <OperationalMetricGrid
                  columns={5}
                  items={[
                    {
                      label: "Under monitoring",
                      value: remediationSummary.underMonitoring,
                      variant: "default"
                    },
                    {
                      label: "Improvement",
                      value: remediationSummary.improvementObserved,
                      variant: "emerald"
                    },
                    {
                      label: "Follow-up",
                      value: remediationSummary.followUpRequired,
                      variant: "amber"
                    },
                    {
                      label: "Rollback risk",
                      value: remediationSummary.rollbackCandidates,
                      variant: "rose"
                    },
                    {
                      label: "Closed · no material change",
                      value: remediationSummary.closedNoMaterial,
                      variant: "default"
                    }
                  ]}
                />
              </div>
            </div>
            <p className="mt-3 border-t border-slate-100 pt-3 text-[10px] leading-snug text-slate-400">
              {remediationSummary.footer}
            </p>
          </div>
        </Card>
      </section>

      {dashboardToast ? (
        <div
          className="fixed bottom-4 right-4 z-[110] max-w-sm rounded-md border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-800 shadow-lg"
          role="status"
        >
          {dashboardToast}
        </div>
      ) : null}
    </section>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
    >
      {label}
      <span aria-hidden className="text-slate-400">
        ×
      </span>
      <span className="sr-only">Clear {label}</span>
    </button>
  );
}

function OwnerPivotToolbar({
  details,
  onEvidencePrimary,
  evidencePrimaryLabel
}: {
  details: OwnerTeamDetails;
  onEvidencePrimary: () => void;
  evidencePrimaryLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointer(e: MouseEvent | TouchEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("touchstart", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("touchstart", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  const evidenceId = "owner-pivot-menu-evidence";

  return (
    <div ref={wrapRef} className="relative flex shrink-0 items-center gap-0.5">
      <div className="relative">
        <button
          type="button"
          id={evidenceId}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "inline-flex h-8 items-center gap-0.5 rounded-md border border-slate-200 bg-white px-2 text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50",
            open && "border-slate-300 bg-slate-50"
          )}
          title="Evidence pack"
        >
          <PackageOpen className="h-4 w-4 shrink-0" aria-hidden />
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
        </button>
        {open ? (
          <div
            role="dialog"
            aria-labelledby={evidenceId}
            className="absolute right-0 top-full z-40 mt-1 w-[min(100vw-2rem,17rem)] rounded-md border border-slate-200 bg-white py-2 shadow-lg"
          >
            <div className="border-b border-slate-100 px-3 pb-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Evidence pack
              </p>
              <p className="mt-1 text-[11px] text-slate-600">
                Lead: <span className="font-medium text-slate-900">{details.teamLead}</span>
              </p>
              <p className="mt-1 text-[11px] text-slate-600">
                Status:{" "}
                <span className="font-medium text-slate-900">{details.evidencePackStatus}</span>
              </p>
            </div>
            <div className="px-2 pt-2">
              <button
                type="button"
                className="w-full rounded-md bg-slate-900 px-3 py-2 text-left text-[12px] font-semibold text-white hover:bg-slate-800"
                onClick={() => {
                  onEvidencePrimary();
                  setOpen(false);
                }}
              >
                {evidencePrimaryLabel}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

type OperationalMetricVariant = "default" | "emerald" | "amber" | "rose";

function operationalMetricValueClass(variant?: OperationalMetricVariant): string {
  if (variant === "emerald") return "text-emerald-700";
  if (variant === "amber") return "text-amber-700";
  if (variant === "rose") return "text-rose-700";
  return "text-slate-900";
}

function OperationalMetricGrid({
  items,
  columns
}: {
  items: { label: string; value: number; variant?: OperationalMetricVariant }[];
  columns: 4 | 5;
}) {
  const grid =
    columns === 5
      ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
      : "grid-cols-2 lg:grid-cols-4";
  return (
    <dl className={cn("mt-2 grid gap-x-4 gap-y-3", grid)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-[11px] leading-snug text-slate-500">{item.label}</dt>
          <dd
            className={cn(
              "mt-0.5 text-xl font-semibold tabular-nums tracking-tight",
              operationalMetricValueClass(item.variant)
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function KpiGovernance({
  label,
  value,
  caption,
  accent
}: {
  label: string;
  value: string | number;
  caption: string;
  accent: "slate" | "rose" | "amber" | "emerald";
}) {
  const bar =
    accent === "rose"
      ? "bg-rose-500"
      : accent === "amber"
        ? "bg-amber-500"
        : accent === "emerald"
          ? "bg-emerald-500"
          : "bg-slate-400";
  return (
    <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-none">
      <span className={cn("absolute left-0 top-0 h-full w-0.5", bar)} aria-hidden />
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-[11px] leading-snug text-slate-500">{caption}</p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  format
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  format: (v: string) => string;
}) {
  return (
    <label className="flex items-center gap-2 text-[12px] text-slate-600">
      <span className="whitespace-nowrap font-medium">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[12px] font-medium text-slate-800 shadow-sm"
      >
        {options.map((opt) => (
          <option key={opt || "all"} value={opt}>
            {format(opt)}
          </option>
        ))}
      </select>
    </label>
  );
}
