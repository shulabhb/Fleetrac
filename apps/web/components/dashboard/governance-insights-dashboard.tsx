"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronDown, PackageOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { buildOwnerQueueRowsFromApi } from "@/lib/governance-merge";
import { GovernanceLoopStatus } from "@/components/dashboard/governance-loop-status";
import { cn } from "@/lib/cn";
import { useGovernanceData } from "@/hooks/use-governance-data";
import {
  GOVERNED_FLEET_SYSTEM_COUNT,
  GOVERNED_FLEET_SYSTEMS_SUB
} from "@/lib/governed-fleet-registry";
import {
  DEFAULT_OWNER_TEAM,
  DEFAULT_SYSTEM_ID,
  formatRiskMixCompact,
  ownerActionCopyForTeam,
  type GovernedSystem,
  type OwnerInsight,
  type OwnerNotificationUIFlag,
  type OwnerTeamDetails
} from "@/lib/dashboard-types";
import { PRIMARY_OWNER_TEAMS } from "@/lib/governance-api";
import { withAiScope, type AiScopeId } from "@/lib/ai-scope";
import {
  routeToEvidenceLibraryOwnerPackage,
  routeToIncidentsForOwner,
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

function slaTone(sla: import("@/lib/dashboard-types").SlaRiskLevel): string {
  if (sla === "High") return "text-rose-700";
  if (sla === "Medium") return "text-amber-700";
  return "text-emerald-700";
}

function statusBadgeTone(st: GovernedSystem["status"]): "high" | "medium" | "low" {
  if (st === "Critical") return "high";
  if (st === "High") return "medium";
  return "low";
}

/** Status word coloring for compact priority rows (metadata only). */
function governanceStatusTone(st: GovernedSystem["status"]): string {
  if (st === "Critical" || st === "High") return "text-rose-700";
  if (st === "Medium") return "text-amber-700";
  return "text-emerald-700";
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
  const { dashboard: apiDashboard, ownerQueues, evidenceByAlias, governanceSystems } =
    useGovernanceData();

  const ownerInsights = useMemo(
    () => buildOwnerInsightsFromApi(ownerQueues, apiDashboard),
    [ownerQueues, apiDashboard]
  );

  const governedSystems = useMemo(
    () => buildGovernedSystemsFromApi(governanceSystems, ownerQueues),
    [governanceSystems, ownerQueues]
  );

  const remediationSummary = useMemo(
    () => buildRemediationEvidenceSummaryFromApi(apiDashboard),
    [apiDashboard]
  );

  const kpi = useMemo(() => {
    const ownersAboveTolerance = apiDashboard
      ? Object.keys(apiDashboard.owner_open_counts).filter(
          (team) => (apiDashboard.owner_open_counts[team] ?? 0) > 0
        ).length
      : 0;
    return {
      activeIncidents: apiDashboard?.active_incidents ?? 0,
      activeIncidentsSub: apiDashboard
        ? `${apiDashboard.critical_incidents} critical · live from simulator`
        : "Awaiting simulator ingest",
      criticalDecisions: apiDashboard?.decisions_needed ?? 0,
      criticalDecisionsSub: `${apiDashboard?.actions_awaiting_approval ?? 0} awaiting Action Center approval`,
      remediationVerified: apiDashboard?.verification_improved ?? 0,
      remediationVerifiedSub: `${apiDashboard?.verification_count ?? 0} under verification tracking`,
      governedSystems: governanceSystems?.total ?? GOVERNED_FLEET_SYSTEM_COUNT,
      governedSystemsSub: GOVERNED_FLEET_SYSTEMS_SUB,
      ownersAboveTolerance,
      ownersAboveToleranceSub: "Owner teams with open queue load"
    };
  }, [apiDashboard, governanceSystems]);

  const loopMetrics = useMemo(
    () => buildGovernanceLoopFromApi(apiDashboard),
    [apiDashboard]
  );

  const headerPosture = useMemo(() => {
    let openIncidents = governedSystems.reduce((sum, sys) => sum + sys.openIncidents, 0);
    let decisionsNeeded = ownerInsights.reduce((sum, o) => sum + o.decisionsNeeded, 0);
    let ownersAboveTolerance = PRIMARY_OWNER_TEAMS.filter((team) => {
      const insight = ownerInsights.find((o) => o.ownerTeam === team);
      return insight != null && (insight.slaRisk === "High" || insight.critical > 0);
    }).length;

    if (apiDashboard) {
      openIncidents = apiDashboard.active_incidents;
      decisionsNeeded = apiDashboard.decisions_needed;
      ownersAboveTolerance = Object.keys(apiDashboard.owner_open_counts).filter(
        (team) => (apiDashboard.owner_open_counts[team] ?? 0) > 0
      ).length;
    }

    return {
      governedSystems: governanceSystems?.total ?? GOVERNED_FLEET_SYSTEM_COUNT,
      openIncidents,
      decisionsNeeded,
      ownersAboveTolerance
    };
  }, [apiDashboard, governedSystems, ownerInsights, governanceSystems]);

  const filteredSystems = useMemo(() => {
    return governedSystems.filter((sys) => {
      if (filters.ownerTeam && sys.ownerTeam !== filters.ownerTeam) return false;
      if (filters.riskCategory && sys.primaryRisk !== filters.riskCategory) return false;
      if (filters.severity && sys.status !== filters.severity) return false;
      return true;
    }).sort(compareSystems);
  }, [filters, governedSystems]);

  const selectedSystem = useMemo(
    () => governedSystems.find((s) => s.id === selectedSystemId) ?? governedSystems[0],
    [selectedSystemId, governedSystems]
  );

  const ownerInsightRow = useMemo(
    () => ownerInsights.find((o) => o.ownerTeam === selectedOwnerTeam) ?? ownerInsights[0],
    [selectedOwnerTeam, ownerInsights]
  );

  const ownerActionCopy = useMemo(
    () => ownerActionCopyForTeam(selectedOwnerTeam, ownerInsightRow),
    [selectedOwnerTeam, ownerInsightRow]
  );

  const ownerPriorityRows = useMemo(() => {
    const rows = buildOwnerQueueRowsFromApi(
      ownerQueues[selectedOwnerTeam],
      evidenceByAlias,
      selectedOwnerTeam
    );
    return rows.slice(0, 5).map((row) => ({
      systemId: row.systemId,
      decisionLine: row.title,
      assignedMember: row.assignedTo !== "—" ? row.assignedTo : undefined
    }));
  }, [selectedOwnerTeam, ownerQueues, evidenceByAlias]);

  const ownerQueueHref = scopeHref(routeToIncidentsForOwner(selectedOwnerTeam));

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

  const onPrioritySystemClick = (systemId: string) => {
    const sys = governedSystems.find((s) => s.id === systemId);
    if (sys) focusOwnerFromSystem(sys);
  };

  const reviewOwnerQueue = useCallback(() => {
    const team = highestRiskOwnerTeamFromInsights(ownerInsights);
    router.push(scopeHref(routeToIncidentsOwnerQueue(team)));
  }, [router, scopeHref]);

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
      ? "Prepare evidence library"
      : "Open evidence library";

  return (
    <section className="space-y-10 pb-8">
      {/* Header */}
      <header className="flex flex-col gap-4 border-b border-slate-100 pb-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Observe · Orient · Govern
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-[26px]">
            Governance Insights
          </h1>
          <div className="flex max-w-3xl flex-wrap gap-1.5 pt-1">
            <SummaryMini
              compact
              label="AI systems governed"
              value={String(headerPosture.governedSystems)}
            />
            <SummaryMini
              compact
              label="Open incidents"
              value={String(headerPosture.openIncidents)}
            />
            <SummaryMini
              compact
              label="Decisions needed"
              value={String(headerPosture.decisionsNeeded)}
            />
            <SummaryMini
              compact
              label="Owners above risk tolerance"
              value={String(headerPosture.ownersAboveTolerance)}
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
            Review owner queue
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </header>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiGovernance
          label="Governed AI Systems"
          value={kpi.governedSystems}
          caption={kpi.governedSystemsSub}
          accent="slate"
        />
        <KpiGovernance
          label="Active Governance Incidents"
          value={kpi.activeIncidents}
          caption={kpi.activeIncidentsSub}
          accent="rose"
        />
        <KpiGovernance
          label="Critical Decisions Needed"
          value={kpi.criticalDecisions}
          caption={kpi.criticalDecisionsSub}
          accent="amber"
        />
        <KpiGovernance
          label="Owners Above Risk Tolerance"
          value={kpi.ownersAboveTolerance}
          caption={kpi.ownersAboveToleranceSub}
          accent="rose"
        />
        <KpiGovernance
          label="Remediation Verification"
          value={`${kpi.remediationVerified} improved`}
          caption={kpi.remediationVerifiedSub}
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
                        "cursor-pointer border-b border-slate-100 transition-colors last:border-b-0",
                        selected
                          ? "bg-slate-50 ring-1 ring-inset ring-slate-200"
                          : "hover:bg-slate-100/70"
                      )}
                    >
                      <td className="relative px-3 py-2.5 font-medium text-slate-900">
                        {selected ? (
                          <span
                            className="absolute left-0 top-0 h-full w-0.5 bg-slate-900"
                            aria-hidden
                          />
                        ) : null}
                        <span className="pl-0">{row.ownerTeam}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-[10px] font-medium text-slate-400">
                        {ownerStatus}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-800">
                        {row.open}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-900">
                        {row.critical}
                      </td>
                      <td className="max-w-[200px] px-3 py-2.5 text-[11px] leading-snug text-slate-500">
                        {formatRiskMixCompact(row)}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-slate-800">{row.bottleneck}</td>
                      <td className={cn("px-3 py-2.5 text-[12px] font-semibold", slaTone(row.slaRisk))}>
                        {row.slaRisk}
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
          <Card className="flex h-full min-h-0 flex-1 flex-col overflow-hidden shadow-none ring-1 ring-slate-100">
            <>
                <div className="shrink-0 border-b border-slate-100 bg-white px-4 pb-3 pt-4">
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
                  <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-snug text-slate-500">
                    <span className="font-semibold text-slate-900">{selectedOwnerTeam}</span>
                    <span className="text-slate-300" aria-hidden>
                      ·
                    </span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                        ownerPivotStatusPill(activeOwnerTeamDetails.notificationStatus)
                      )}
                    >
                      {activeOwnerTeamDetails.notificationStatus}
                    </span>
                    <span className="text-slate-300" aria-hidden>
                      ·
                    </span>
                    <span className="text-slate-600">{evidenceStatusPhrase(activeOwnerTeamDetails)}</span>
                    {activeOwnerTeamDetails.lastNotifiedAt !== "—" ? (
                      <>
                        <span className="text-slate-300" aria-hidden>
                          ·
                        </span>
                        <span className="tabular-nums text-slate-500">
                          Last notified {activeOwnerTeamDetails.lastNotifiedAt}
                        </span>
                      </>
                    ) : null}
                  </p>
                  <p className="mt-2 text-[11px] leading-snug text-slate-600">
                    <span className="font-medium text-slate-800">
                      Blocked at {ownerInsightRow.bottleneck}
                    </span>
                    <span className="text-slate-300"> · </span>
                    <span className="tabular-nums text-slate-500">
                      {ownerInsightRow.open} open · {ownerInsightRow.critical} critical ·{" "}
                      {ownerInsightRow.decisionsNeeded} decisions · oldest {ownerInsightRow.oldestEvidenceAge}
                    </span>
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                    <Link
                      href={ownerQueueHref}
                      className="inline-flex items-center rounded-md bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-slate-800"
                    >
                      Review owner queue →
                    </Link>
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
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-3">
                  <div className="space-y-2.5">
                    <GovernanceLoopStatus
                      compact
                      variant="owner"
                      currentStage={ownerInsightRow.governanceStage}
                      stageSummary={ownerInsightRow.stageSummary}
                    />

                    <div className="rounded-md border border-slate-100 bg-white px-2.5 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Decision
                      </p>
                      <p className="mt-0.5 text-[13px] font-semibold leading-snug text-slate-900">
                        {ownerActionCopy.headline}
                      </p>
                      <p className="mt-1 text-[11px] leading-snug text-slate-600">
                        {ownerActionCopy.recommendedAction}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Priority
                      </p>
                      <ul className="mt-2 divide-y divide-slate-200">
                        {ownerPriorityRows.map((row) => {
                          const sys = governedSystems.find((s) => s.id === row.systemId);
                          if (!sys) return null;
                          const metaBits = [
                            sys.primaryRisk,
                            sys.status,
                            sys.evidenceAge,
                            ...(row.assignedMember ? [row.assignedMember] : [])
                          ];
                          return (
                            <li key={row.systemId}>
                              <button
                                type="button"
                                onClick={() => onPrioritySystemClick(row.systemId)}
                                className="w-full cursor-pointer py-2.5 text-left transition hover:bg-slate-50/90"
                              >
                                <p className="text-[12px] font-semibold leading-snug text-slate-900">
                                  {sys.name}
                                </p>
                                <p className="mt-0.5 text-[11px] leading-snug text-slate-700">
                                  {row.decisionLine}
                                </p>
                                <p className="mt-0.5 text-[10px] leading-snug text-slate-500">
                                  {metaBits.join(" · ")}
                                </p>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </div>
              </>
          </Card>
        </div>
      </div>

      {/* Systems table */}
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            Systems Requiring Governance Action
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Prioritized AI systems with open governance incidents.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
        </div>
        {filters.ownerTeam ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50/90 px-3 py-2 text-[12px] text-slate-600">
            <span>
              Showing systems owned by:{" "}
              <span className="font-medium text-slate-800">{filters.ownerTeam}</span>
            </span>
            <button
              type="button"
              onClick={clearOwnerFilter}
              className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Clear
            </button>
          </div>
        ) : null}
        <Card className="overflow-hidden shadow-none">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2.5 text-left">AI System</th>
                  <th className="px-3 py-2.5 text-left">Type</th>
                  <th className="px-3 py-2.5 text-left">Platform</th>
                  <th className="px-3 py-2.5 text-left">Owner</th>
                  <th className="px-3 py-2.5 text-left">Primary Risk</th>
                  <th className="px-3 py-2.5 text-left">Status</th>
                  <th className="px-3 py-2.5 text-right">Open</th>
                  <th className="px-3 py-2.5 text-right">Critical</th>
                  <th className="px-3 py-2.5 text-left">Evidence Age</th>
                  <th className="px-3 py-2.5 text-left">Next Action</th>
                </tr>
              </thead>
              <tbody>
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
                        "cursor-pointer border-b border-slate-100 transition-colors last:border-b-0",
                        sel ? "bg-slate-50" : "hover:bg-slate-50/70"
                      )}
                    >
                      <td className="relative px-3 py-2.5">
                        {sel ? (
                          <span className="absolute left-0 top-0 h-full w-0.5 bg-slate-900" aria-hidden />
                        ) : null}
                        <span className="font-medium text-slate-900">{sys.name}</span>
                        <span className="ml-1.5 font-mono text-[11px] text-slate-400">{sys.id}</span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">{sys.type}</td>
                      <td className="px-3 py-2.5 text-slate-700">{sys.platform}</td>
                      <td className="px-3 py-2.5 text-slate-700">{sys.ownerTeam}</td>
                      <td className="px-3 py-2.5 text-slate-700">{sys.primaryRisk}</td>
                      <td className="px-3 py-2.5">
                        <Badge tone={statusBadgeTone(sys.status)} size="xs">
                          {sys.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-800">
                        {sys.openIncidents}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-900">
                        {sys.criticalIncidents}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-slate-700">{sys.evidenceAge}</td>
                      <td className="px-3 py-2.5 text-[12px] font-medium text-slate-800">
                        {sys.nextAction}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

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
                    { label: "Open incidents", value: loopMetrics.investigations.open },
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
                Open Incident Queue →
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
                Evidence Library →
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

function evidenceStatusPhrase(details: OwnerTeamDetails): string {
  switch (details.evidencePackStatus) {
    case "Not generated":
      return "Evidence not generated";
    case "Generated":
      return "Evidence generated";
    case "Sent":
      return "Evidence sent";
    default:
      return "Evidence";
  }
}

function ownerPivotStatusPill(s: OwnerNotificationUIFlag): string {
  if (s === "Pending") return "border border-amber-200 bg-amber-50 text-amber-900";
  if (s === "Monitoring") return "border border-slate-200 bg-slate-50 text-slate-600";
  if (s === "Acknowledged") return "border border-slate-200/80 bg-white text-slate-700";
  return "border border-emerald-200/70 bg-emerald-50/80 text-emerald-900";
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
