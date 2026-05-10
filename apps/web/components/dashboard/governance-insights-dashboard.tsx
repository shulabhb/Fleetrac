"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronDown, PackageOpen, UserCog } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { GovernanceLoopStatus } from "@/components/dashboard/governance-loop-status";
import { ManageAssignmentModal } from "@/components/dashboard/manage-assignment-modal";
import { cn } from "@/lib/cn";
import {
  DEFAULT_OWNER_TEAM,
  DEFAULT_SYSTEM_ID,
  DASHBOARD_KPI,
  decisionPanelCopyForSystem,
  GOVERNANCE_LOOP,
  GOVERNED_SYSTEMS,
  highestRiskOwnerTeam,
  INCIDENTS_BY_SYSTEM,
  ownerActionCopyForTeam,
  formatRiskMixCompact,
  getOwnerTeamDetails,
  ownerPriorityQueueRows,
  OWNER_INSIGHTS,
  primaryIncidentForPanel,
  REMEDIATION_EVIDENCE_SUMMARY,
  type GovernanceIncident,
  type GovernedSystem,
  type OwnerInsight,
  type OwnerNotificationUIFlag,
  type OwnerTeamDetails,
  type SlaRiskLevel
} from "@/lib/governance-dashboard-mock";
import { withAiScope, type AiScopeId } from "@/lib/ai-scope";
import {
  routeToBobForTarget,
  routeToIncidentsForSystem,
  routeToIncidentsForOwner,
  routeToOutcomesOwnerEvidencePack,
  routeToSystem,
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

function slaTone(sla: SlaRiskLevel): string {
  if (sla === "High") return "text-rose-700";
  if (sla === "Medium") return "text-amber-700";
  return "text-emerald-700";
}

function statusBadgeTone(st: GovernedSystem["status"]): "high" | "medium" | "low" {
  if (st === "Critical") return "high";
  if (st === "High") return "medium";
  return "low";
}

function severityAccentClass(sev: GovernanceIncident["severity"]): string {
  if (sev === "Critical" || sev === "High") return "text-rose-700";
  if (sev === "Medium") return "text-amber-700";
  return "text-emerald-700";
}

function severityDotClass(sev: GovernanceIncident["severity"]): string {
  if (sev === "Critical" || sev === "High") return "bg-rose-600";
  if (sev === "Medium") return "bg-amber-500";
  return "bg-emerald-600";
}

/** Status word coloring for compact priority rows (metadata only). */
function governanceStatusTone(st: GovernedSystem["status"]): string {
  if (st === "Critical" || st === "High") return "text-rose-700";
  if (st === "Medium") return "text-amber-700";
  return "text-emerald-700";
}

type PanelMode = "owner" | "system";

export function GovernanceInsightsDashboard({ scope }: { scope: AiScopeId }) {
  const router = useRouter();
  const scopeHref = (path: string) => withAiScope(path, scope);
  const [panelMode, setPanelMode] = useState<PanelMode>("owner");
  const [selectedOwnerTeam, setSelectedOwnerTeam] = useState(DEFAULT_OWNER_TEAM);
  const [selectedSystemId, setSelectedSystemId] = useState(DEFAULT_SYSTEM_ID);
  const [filters, setFilters] = useState({
    ownerTeam: DEFAULT_OWNER_TEAM,
    riskCategory: "",
    severity: ""
  });

  const evidencePanelRef = useRef<HTMLDivElement | null>(null);

  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [assignmentMembersByTeam, setAssignmentMembersByTeam] = useState<Record<string, string[]>>(
    {}
  );
  const [notificationOverride, setNotificationOverride] = useState<
    Partial<Record<string, OwnerNotificationUIFlag>>
  >({});
  const [evidencePackOverride, setEvidencePackOverride] = useState<
    Partial<Record<string, OwnerTeamDetails["evidencePackStatus"]>>
  >({});
  const [dashboardToast, setDashboardToast] = useState<string | null>(null);
  const [teamLeadByTeam, setTeamLeadByTeam] = useState<Record<string, string>>({});

  const filteredSystems = useMemo(() => {
    return GOVERNED_SYSTEMS.filter((sys) => {
      if (filters.ownerTeam && sys.ownerTeam !== filters.ownerTeam) return false;
      if (filters.riskCategory && sys.primaryRisk !== filters.riskCategory) return false;
      if (filters.severity && sys.status !== filters.severity) return false;
      return true;
    }).sort(compareSystems);
  }, [filters]);

  useEffect(() => {
    if (panelMode !== "system") return;
    if (!filteredSystems.length) return;
    const visible = filteredSystems.some((s) => s.id === selectedSystemId);
    if (!visible) {
      const next = filteredSystems[0];
      setSelectedSystemId(next.id);
      setSelectedOwnerTeam(next.ownerTeam);
    }
  }, [filteredSystems, selectedSystemId, panelMode]);

  const selectedSystem = useMemo(
    () => GOVERNED_SYSTEMS.find((s) => s.id === selectedSystemId) ?? GOVERNED_SYSTEMS[0],
    [selectedSystemId]
  );

  const incidentsForSelected = INCIDENTS_BY_SYSTEM[selectedSystem.id] ?? [];

  const primaryIncident = useMemo(
    () => primaryIncidentForPanel(selectedSystem.id, incidentsForSelected),
    [selectedSystem.id, incidentsForSelected]
  );

  const decisionCopy = useMemo(
    () => decisionPanelCopyForSystem(selectedSystem.id),
    [selectedSystem.id]
  );

  const oldestIncidentAge = useMemo(() => {
    if (!incidentsForSelected.length) return "—";
    const maxDays = Math.max(...incidentsForSelected.map((i) => parseEvidenceAge(i.age)));
    return `${maxDays}d`;
  }, [incidentsForSelected]);

  const visibleIncidents = incidentsForSelected.slice(0, 4);
  const hasMoreIncidents = incidentsForSelected.length > 4;

  const investigationHref = primaryIncident
    ? scopeHref(routeToBobForTarget("incident", primaryIncident.id))
    : scopeHref(routeToIncidentsForSystem(selectedSystem.id));

  const ownerInsightRow = useMemo(
    () => OWNER_INSIGHTS.find((o) => o.ownerTeam === selectedOwnerTeam) ?? OWNER_INSIGHTS[0],
    [selectedOwnerTeam]
  );

  const ownerActionCopy = useMemo(
    () => ownerActionCopyForTeam(selectedOwnerTeam, ownerInsightRow),
    [selectedOwnerTeam, ownerInsightRow]
  );

  const ownerPriorityRows = useMemo(() => {
    const baseRows = ownerPriorityQueueRows(selectedOwnerTeam);
    const override = assignmentMembersByTeam[selectedOwnerTeam];
    if (!override?.length) return baseRows;
    return baseRows.map((row, i) => ({
      ...row,
      assignedMember: override[i % override.length]
    }));
  }, [selectedOwnerTeam, assignmentMembersByTeam]);

  const ownerQueueHref = scopeHref(routeToIncidentsForOwner(selectedOwnerTeam));

  const activeOwnerTeamDetails = useMemo((): OwnerTeamDetails => {
    const base = getOwnerTeamDetails(selectedOwnerTeam);
    const members = assignmentMembersByTeam[selectedOwnerTeam] ?? base.members;
    const teamLead = teamLeadByTeam[selectedOwnerTeam] ?? base.teamLead;
    const notificationStatus =
      notificationOverride[selectedOwnerTeam] ?? base.notificationStatus;
    const evidencePackStatus =
      evidencePackOverride[selectedOwnerTeam] ?? base.evidencePackStatus;
    return { ...base, members, teamLead, notificationStatus, evidencePackStatus };
  }, [
    selectedOwnerTeam,
    assignmentMembersByTeam,
    teamLeadByTeam,
    notificationOverride,
    evidencePackOverride
  ]);

  const clearOwnerFilter = useCallback(() => {
    const fleetOwner = highestRiskOwnerTeam();
    setFilters((f) => ({ ...f, ownerTeam: "" }));
    setPanelMode("owner");
    const fullSorted = [...GOVERNED_SYSTEMS].sort(compareSystems);
    const stillVisible = fullSorted.some((s) => s.id === selectedSystemId);
    if (stillVisible) {
      setSelectedOwnerTeam(fleetOwner);
    } else if (fullSorted[0]) {
      setSelectedSystemId(fullSorted[0].id);
      setSelectedOwnerTeam(fullSorted[0].ownerTeam);
    }
  }, [selectedSystemId]);

  const onOwnerTeamFilterChange = useCallback(
    (ownerTeam: string) => {
      if (ownerTeam) {
        setFilters((f) => ({ ...f, ownerTeam: ownerTeam }));
        setPanelMode("owner");
        setSelectedOwnerTeam(ownerTeam);
      } else {
        clearOwnerFilter();
      }
    },
    [clearOwnerFilter]
  );

  const onOwnerRowClick = (row: OwnerInsight) => {
    setPanelMode("owner");
    setSelectedOwnerTeam(row.ownerTeam);
    setFilters((f) => ({ ...f, ownerTeam: row.ownerTeam }));
  };

  const openSystemContext = useCallback((sys: GovernedSystem) => {
    setPanelMode("system");
    setSelectedSystemId(sys.id);
    setSelectedOwnerTeam(sys.ownerTeam);
    setFilters((f) => {
      if (f.ownerTeam && f.ownerTeam !== sys.ownerTeam) {
        return { ...f, ownerTeam: "" };
      }
      return f;
    });
  }, []);

  const onSystemRowClick = (sys: GovernedSystem) => {
    openSystemContext(sys);
  };

  const onPrioritySystemClick = (systemId: string) => {
    const sys = GOVERNED_SYSTEMS.find((s) => s.id === systemId);
    if (sys) openSystemContext(sys);
  };

  const reviewHighestRisk = useCallback(() => {
    const topSystem = [...GOVERNED_SYSTEMS].sort(compareSystems)[0];
    setPanelMode("system");
    setSelectedSystemId(topSystem.id);
    setSelectedOwnerTeam(topSystem.ownerTeam);
    setFilters((f) => ({ ...f, ownerTeam: topSystem.ownerTeam }));
    window.requestAnimationFrame(() => {
      evidencePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, []);

  const needsIncidentFallback =
    incidentsForSelected.length === 0 &&
    (selectedSystem.status === "Critical" || selectedSystem.status === "High");

  const packageIncidentHref = scopeHref(routeToIncidentsForSystem(selectedSystem.id));

  const ownerTeams = useMemo(
    () => Array.from(new Set(GOVERNED_SYSTEMS.map((s) => s.ownerTeam))).sort(),
    []
  );

  const showDashboardToast = useCallback((msg: string) => {
    setDashboardToast(msg);
    window.setTimeout(() => setDashboardToast(null), 3000);
  }, []);

  const openOwnerEvidencePack = useCallback(() => {
    const status = activeOwnerTeamDetails.evidencePackStatus;
    if (status === "Not generated") {
      setEvidencePackOverride((e) => ({ ...e, [selectedOwnerTeam]: "Generated" }));
      showDashboardToast("Evidence pack generated");
    }
    router.push(scopeHref(routeToOutcomesOwnerEvidencePack(selectedOwnerTeam)));
  }, [
    activeOwnerTeamDetails.evidencePackStatus,
    selectedOwnerTeam,
    router,
    scopeHref,
    showDashboardToast
  ]);

  const notifyOwnerLead = useCallback(() => {
    setNotificationOverride((n) => ({ ...n, [selectedOwnerTeam]: "Notified" }));
    showDashboardToast("Owner notified");
  }, [selectedOwnerTeam, showDashboardToast]);

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
          <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
            {DASHBOARD_KPI.governedSystems} AI systems governed · {DASHBOARD_KPI.activeIncidents}{" "}
            open incidents · {DASHBOARD_KPI.criticalDecisions} decisions needed ·{" "}
            {DASHBOARD_KPI.ownersAboveTolerance} owners above risk tolerance
          </p>
        </div>
        <button
          type="button"
          onClick={reviewHighestRisk}
          className="inline-flex shrink-0 items-center gap-2 rounded-md border border-slate-900 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          Review highest-risk incident
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </header>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiGovernance
          label="Governed AI Systems"
          value={DASHBOARD_KPI.governedSystems}
          caption={DASHBOARD_KPI.governedSystemsSub}
          accent="slate"
        />
        <KpiGovernance
          label="Active Governance Incidents"
          value={DASHBOARD_KPI.activeIncidents}
          caption={DASHBOARD_KPI.activeIncidentsSub}
          accent="rose"
        />
        <KpiGovernance
          label="Critical Decisions Needed"
          value={DASHBOARD_KPI.criticalDecisions}
          caption={DASHBOARD_KPI.criticalDecisionsSub}
          accent="amber"
        />
        <KpiGovernance
          label="Owners Above Risk Tolerance"
          value={DASHBOARD_KPI.ownersAboveTolerance}
          caption={DASHBOARD_KPI.ownersAboveToleranceSub}
          accent="rose"
        />
        <KpiGovernance
          label="Remediation Verification"
          value={`${DASHBOARD_KPI.remediationVerified} improved`}
          caption={DASHBOARD_KPI.remediationVerifiedSub}
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
                {OWNER_INSIGHTS.map((row) => {
                  const ownerStatus = getOwnerTeamDetails(row.ownerTeam).notificationStatus;
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
            {panelMode === "owner" ? (
              <>
                <div className="shrink-0 border-b border-slate-100 bg-white px-4 pb-3 pt-4">
                  <CardHeader
                    title="Owner Action Panel"
                    action={
                      <OwnerPivotToolbar
                        details={activeOwnerTeamDetails}
                        onOpenAssignment={() => setAssignmentModalOpen(true)}
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
                          const sys = GOVERNED_SYSTEMS.find((s) => s.id === row.systemId);
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
            ) : (
              <>
                <div className="shrink-0 border-b border-slate-100 px-4 pb-3 pt-4">
                  <CardHeader title="System Decision Panel" />
                  <p className="mt-2 text-[11px] leading-snug text-slate-500">Selected system</p>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-3">
                  <div className="space-y-3">
                {/* System identity */}
                <div>
                  <p className="text-lg font-semibold leading-snug text-slate-900">
                    {selectedSystem.name}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                    {selectedSystem.id} · {selectedSystem.businessFunction} · {selectedSystem.platform}{" "}
                    · {selectedSystem.type}
                  </p>
                  <p className="mt-1.5 text-[11px] text-slate-600">
                    <span className="text-slate-500">Owner:</span>{" "}
                    <span className="font-medium text-slate-800">{selectedSystem.ownerTeam}</span>
                  </p>
                  {selectedSystem.dataSensitivity === "Critical" ? (
                    <p className="mt-1 text-[10px] text-slate-400">
                      Sensitivity: {selectedSystem.dataSensitivity}
                    </p>
                  ) : null}
                </div>

                {/* Compact risk summary */}
                <div className="grid grid-cols-4 gap-2 rounded-md border border-slate-100 bg-slate-50/60 px-2 py-2 text-center">
                  <div className="min-w-0">
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </p>
                    <div className="mt-1 flex justify-center">
                      <Badge tone={statusBadgeTone(selectedSystem.status)} size="xs" dot>
                        {selectedSystem.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="min-w-0 border-l border-slate-200/80">
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                      Open
                    </p>
                    <p className="mt-1 text-[13px] font-semibold tabular-nums text-slate-800">
                      {selectedSystem.openIncidents}
                    </p>
                  </div>
                  <div className="min-w-0 border-l border-slate-200/80">
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                      Critical
                    </p>
                    <p className="mt-1 text-[13px] font-semibold tabular-nums text-slate-800">
                      {selectedSystem.criticalIncidents}
                    </p>
                  </div>
                  <div className="min-w-0 border-l border-slate-200/80">
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                      Oldest
                    </p>
                    <p className="mt-1 text-[13px] font-semibold tabular-nums text-slate-600">
                      {oldestIncidentAge}
                    </p>
                  </div>
                </div>

                <GovernanceLoopStatus
                  variant="system"
                  currentStage={selectedSystem.governanceStage}
                  stageSummary={selectedSystem.stageSummary}
                />

                {/* Primary decision */}
                <div className="rounded-md border border-slate-200 bg-white px-3 py-3 shadow-sm">
                  {needsIncidentFallback ? (
                    <>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Decision needed
                      </p>
                      <p className="mt-1 text-[14px] font-semibold leading-snug text-slate-900">
                        Review open governance signals
                      </p>
                      <p className="mt-1.5 text-[12px] leading-snug text-slate-600">
                        This system has open risk signals but no packaged incident details yet.
                      </p>
                      <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Recommended action
                      </p>
                      <p className="mt-0.5 text-[13px] font-medium leading-snug text-slate-900">
                        Send to Incident Queue for packaging.
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Link
                          href={packageIncidentHref}
                          className="inline-flex items-center rounded-md bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-slate-800"
                        >
                          Package incident →
                        </Link>
                        <Link
                          href={scopeHref(routes.actions())}
                          className="text-[12px] font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                        >
                          Send to Action Center
                        </Link>
                        <Link
                          href={scopeHref(routeToBobForTarget("system", selectedSystem.id))}
                          className="text-[12px] font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                        >
                          Generate evidence pack
                        </Link>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Decision needed
                      </p>
                      <p className="mt-1 text-[14px] font-semibold leading-snug text-slate-900">
                        {decisionCopy.headline}
                      </p>
                      <p className="mt-1.5 text-[12px] leading-snug text-slate-600">{decisionCopy.context}</p>
                      <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Recommended action
                      </p>
                      <p className="mt-0.5 text-[13px] font-medium leading-snug text-slate-900">
                        {decisionCopy.recommendedAction}
                      </p>
                      <p className="mt-2 text-[11px] text-slate-500">{decisionCopy.evidenceSummary}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Link
                          href={investigationHref}
                          className="inline-flex items-center rounded-md bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-slate-800"
                        >
                          Open investigation →
                        </Link>
                        <Link
                          href={scopeHref(routes.actions())}
                          className="text-[12px] font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                        >
                          Send to Action Center
                        </Link>
                        <Link
                          href={scopeHref(routeToBobForTarget("system", selectedSystem.id))}
                          className="text-[12px] font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                        >
                          Generate evidence pack
                        </Link>
                      </div>
                    </>
                  )}
                </div>

                {/* Open incidents — compact rows */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Open incidents
                  </p>
                  {incidentsForSelected.length === 0 ? (
                    <p className="mt-2 text-[12px] text-slate-500">
                      {needsIncidentFallback
                        ? "Package incidents in the queue to populate this list."
                        : selectedSystem.status === "Critical" || selectedSystem.status === "High"
                          ? "Packaged incidents are being reconciled for this system."
                          : "No packaged incidents for this view."}
                    </p>
                  ) : (
                    <ul className="mt-2 divide-y divide-slate-100 border border-slate-100 rounded-md bg-white">
                      {visibleIncidents.map((inc) => {
                        const isPrimary = primaryIncident?.id === inc.id;
                        return (
                          <li
                            key={inc.id}
                            className={cn(
                              "flex gap-2 px-2.5 py-2",
                              isPrimary ? "bg-slate-50/90" : ""
                            )}
                          >
                            <span
                              className={cn(
                                "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                                severityDotClass(inc.severity)
                              )}
                              aria-hidden
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-[12px] leading-snug text-slate-900">
                                <span
                                  className={cn(
                                    "font-semibold tabular-nums",
                                    severityAccentClass(inc.severity)
                                  )}
                                >
                                  {inc.severity}
                                </span>
                                <span className="text-slate-400"> · </span>
                                {inc.title}
                              </p>
                              <p className="mt-0.5 text-[11px] text-slate-500">
                                {inc.riskCategory} · {inc.actionState} ·{" "}
                                <span className="text-slate-400">{inc.age}</span>
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {hasMoreIncidents ? (
                    <Link
                      href={scopeHref(routeToIncidentsForSystem(selectedSystem.id))}
                      className="mt-2 inline-block text-[12px] font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                    >
                      View all incidents →
                    </Link>
                  ) : null}
                </div>

                {/* Footer actions */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-slate-100 pt-3">
                  <Link
                    href={needsIncidentFallback ? packageIncidentHref : investigationHref}
                    className="text-[12px] font-semibold text-slate-900 underline decoration-slate-300 underline-offset-2 hover:text-slate-700"
                  >
                    {needsIncidentFallback ? "Package incident →" : "Open investigation →"}
                  </Link>
                  <Link
                    href={scopeHref(routeToSystem(selectedSystem.id))}
                    className="text-[12px] font-medium text-slate-600 hover:text-slate-900"
                  >
                    Assign owner
                  </Link>
                  <Link
                    href={scopeHref(routeToBobForTarget("system", selectedSystem.id))}
                    className="text-[12px] font-medium text-slate-600 hover:text-slate-900"
                  >
                    Create evidence pack
                  </Link>
                </div>
                  </div>
                </div>
              </>
            )}
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
                  const sel = panelMode === "system" && sys.id === selectedSystemId;
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
                  Investigations
                </h3>
                <OperationalMetricGrid
                  columns={4}
                  items={[
                    { label: "Open", value: GOVERNANCE_LOOP.investigations.open },
                    {
                      label: "Awaiting approval",
                      value: GOVERNANCE_LOOP.investigations.awaitingApproval
                    },
                    {
                      label: "Pending recommendations",
                      value: GOVERNANCE_LOOP.investigations.pendingRecommendations
                    },
                    { label: "Recurring patterns", value: GOVERNANCE_LOOP.investigations.recurring }
                  ]}
                />
              </div>
              <Link
                href={scopeHref(routes.bob())}
                className="shrink-0 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                Open Bob →
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
                      value: GOVERNANCE_LOOP.verification.recurrenceReduced,
                      variant: "emerald"
                    },
                    {
                      label: "Improvement observed",
                      value: GOVERNANCE_LOOP.verification.improvement,
                      variant: "default"
                    },
                    {
                      label: "Follow-up required",
                      value: GOVERNANCE_LOOP.verification.followUp,
                      variant: "amber"
                    },
                    {
                      label: "Rollback candidates",
                      value: GOVERNANCE_LOOP.verification.rollback,
                      variant: "rose"
                    }
                  ]}
                />
              </div>
              <Link
                href={scopeHref(routes.outcomes())}
                className="shrink-0 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                Outcomes →
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
                      value: REMEDIATION_EVIDENCE_SUMMARY.underMonitoring,
                      variant: "default"
                    },
                    {
                      label: "Improvement",
                      value: REMEDIATION_EVIDENCE_SUMMARY.improvementObserved,
                      variant: "emerald"
                    },
                    {
                      label: "Follow-up",
                      value: REMEDIATION_EVIDENCE_SUMMARY.followUpRequired,
                      variant: "amber"
                    },
                    {
                      label: "Rollback risk",
                      value: REMEDIATION_EVIDENCE_SUMMARY.rollbackCandidates,
                      variant: "rose"
                    },
                    {
                      label: "Closed · no material change",
                      value: REMEDIATION_EVIDENCE_SUMMARY.closedNoMaterial,
                      variant: "default"
                    }
                  ]}
                />
              </div>
            </div>
            <p className="mt-3 border-t border-slate-100 pt-3 text-[10px] leading-snug text-slate-400">
              {REMEDIATION_EVIDENCE_SUMMARY.footer}
            </p>
          </div>
        </Card>
      </section>

      <ManageAssignmentModal
        open={assignmentModalOpen}
        onClose={() => setAssignmentModalOpen(false)}
        details={{
          ...getOwnerTeamDetails(selectedOwnerTeam),
          evidencePackStatus: activeOwnerTeamDetails.evidencePackStatus,
          lastNotifiedAt: activeOwnerTeamDetails.lastNotifiedAt
        }}
        insight={ownerInsightRow}
        assignedMembers={activeOwnerTeamDetails.members}
        teamLead={activeOwnerTeamDetails.teamLead}
        onSave={(payload) => {
          setAssignmentMembersByTeam((m) => ({ ...m, [selectedOwnerTeam]: payload.members }));
          setTeamLeadByTeam((t) => ({ ...t, [selectedOwnerTeam]: payload.teamLead }));
          showDashboardToast("Assignment updated");
        }}
        onResendNotification={() => {
          showDashboardToast("Notification resent to team lead (demo)");
        }}
      />
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
  onOpenAssignment,
  onEvidencePrimary,
  evidencePrimaryLabel
}: {
  details: OwnerTeamDetails;
  onOpenAssignment: () => void;
  onEvidencePrimary: () => void;
  evidencePrimaryLabel: string;
}) {
  const [open, setOpen] = useState<null | "assignment" | "evidence">(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointer(e: MouseEvent | TouchEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(null);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(null);
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

  const assignmentId = "owner-pivot-menu-assignment";
  const evidenceId = "owner-pivot-menu-evidence";

  return (
    <div ref={wrapRef} className="relative flex shrink-0 items-center gap-0.5">
      <div className="relative">
        <button
          type="button"
          id={assignmentId}
          aria-haspopup="dialog"
          aria-expanded={open === "assignment"}
          onClick={() => setOpen(open === "assignment" ? null : "assignment")}
          className={cn(
            "inline-flex h-8 items-center gap-0.5 rounded-md border border-slate-200 bg-white px-2 text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50",
            open === "assignment" && "border-slate-300 bg-slate-50"
          )}
          title="Assignment"
        >
          <UserCog className="h-4 w-4 shrink-0" aria-hidden />
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
        </button>
        {open === "assignment" ? (
          <div
            role="dialog"
            aria-labelledby={assignmentId}
            className="absolute right-0 top-full z-40 mt-1 w-[min(100vw-2rem,17rem)] rounded-md border border-slate-200 bg-white py-2 shadow-lg"
          >
            <div className="border-b border-slate-100 px-3 pb-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Assignment
              </p>
              <p className="mt-1 text-[12px] font-medium text-slate-900">{details.teamLead}</p>
              <p className="mt-1 text-[11px] leading-snug text-slate-600">{details.leadRole}</p>
              <p className="mt-2 text-[11px] text-slate-500">
                Reviewers:{" "}
                <span className="font-medium text-slate-800">
                  {details.members.length ? details.members.join(", ") : "—"}
                </span>
              </p>
            </div>
            <div className="px-2 pt-2">
              <button
                type="button"
                className="w-full rounded-md bg-slate-900 px-3 py-2 text-left text-[12px] font-semibold text-white hover:bg-slate-800"
                onClick={() => {
                  onOpenAssignment();
                  setOpen(null);
                }}
              >
                Manage assignment
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="relative">
        <button
          type="button"
          id={evidenceId}
          aria-haspopup="dialog"
          aria-expanded={open === "evidence"}
          onClick={() => setOpen(open === "evidence" ? null : "evidence")}
          className={cn(
            "inline-flex h-8 items-center gap-0.5 rounded-md border border-slate-200 bg-white px-2 text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50",
            open === "evidence" && "border-slate-300 bg-slate-50"
          )}
          title="Evidence pack"
        >
          <PackageOpen className="h-4 w-4 shrink-0" aria-hidden />
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
        </button>
        {open === "evidence" ? (
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
                Status:{" "}
                <span className="font-medium text-slate-900">
                  {details.evidencePackStatus === "Not generated"
                    ? "Not generated"
                    : details.evidencePackStatus}
                </span>
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Pack ID: <span className="font-mono text-[10px]">{details.evidencePackId}</span>
              </p>
            </div>
            <div className="px-2 pt-2">
              <button
                type="button"
                className="w-full rounded-md bg-slate-900 px-3 py-2 text-left text-[12px] font-semibold text-white hover:bg-slate-800"
                onClick={() => {
                  onEvidencePrimary();
                  setOpen(null);
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
