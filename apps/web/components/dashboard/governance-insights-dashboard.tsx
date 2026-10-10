"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { GovernanceNotificationBell } from "@/components/fleetrac/governance-notification-bell";
import { RiskTriageDrawer } from "@/components/incidents/risk-detail-panel";
import { cn } from "@/lib/cn";
import { useGovernanceData } from "@/hooks/use-governance-data";
import {
  handoffIncidentToActionCenter,
  PRIMARY_OWNER_TEAMS,
  type NotificationDTO
} from "@/lib/governance-api";
import { buildGlobalOwnerQueueRowsFromApi } from "@/lib/governance-merge";
import { buildGovernedSystemsFromApi } from "@/lib/dashboard-merge";
import { primaryApiActions } from "@/lib/governance-actions-merge";
import {
  filterDemoAgents,
  GOVERNED_FLEET_SYSTEM_COUNT,
  isDemoAgent,
  sortDemoAgentsFirst
} from "@/lib/governed-fleet-registry";
import {
  countDemoRisks,
  drawerTabForOverviewStep,
  verificationResultCount,
  type OverviewLoopTab
} from "@/lib/overview-summary";
import {
  categoryToOverviewKind,
  resolveIncidentLifecycle,
  type NextStepDestination
} from "@/lib/resolve-next-step";
import { withAiScope, type AiScopeId } from "@/lib/ai-scope";
import { routeToIncident, routes } from "@/lib/routes";
import { formatRelativeTime } from "@/lib/format";

type TriageTone = "critical" | "high" | "medium" | "low" | "neutral" | "info";

const TRIAGE_BADGE: Record<TriageTone, string> = {
  critical: "bg-red-100 text-red-800",
  high: "bg-orange-700 text-white",
  medium: "bg-amber-100 text-amber-900",
  low: "bg-emerald-700 text-white",
  neutral: "bg-slate-200 text-slate-800",
  info: "bg-sky-800 text-white"
};

const SEVERITY_BAR: Record<TriageTone, string> = {
  critical: "bg-red-300",
  high: "bg-orange-700",
  medium: "bg-amber-200",
  low: "bg-emerald-700",
  neutral: "bg-slate-300",
  info: "bg-sky-800"
};

function triageTone(value: string | null | undefined): TriageTone {
  const s = (value ?? "").toLowerCase();
  if (s === "critical") return "critical";
  if (s === "high") return "high";
  if (s === "medium") return "medium";
  if (s === "low" || s === "healthy") return "low";
  return "neutral";
}

function TriageBadge({ children, tone }: { children: string | number; tone: TriageTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-none px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        TRIAGE_BADGE[tone]
      )}
    >
      {children}
    </span>
  );
}

function activityLabel(kind: string | null | undefined): string {
  switch (kind) {
    case "decision":
      return "Decision";
    case "verify":
      return "Verification";
    case "rollback":
      return "Rollback";
    case "follow_up":
      return "Follow-up";
    case "improvement":
      return "Improvement";
    case "severity":
      return "Severity";
    case "regression":
      return "Regression";
    default:
      return "Update";
  }
}

export function GovernanceInsightsDashboard({ scope }: { scope: AiScopeId }) {
  const router = useRouter();
  const scopeHref = (path: string) => withAiScope(path, scope);
  const [dashboardToast, setDashboardToast] = useState<string | null>(null);
  const [triageIncidentId, setTriageIncidentId] = useState<string | null>(null);
  const [triageTab, setTriageTab] = useState<OverviewLoopTab>("decision");
  const [triageSending, setTriageSending] = useState(false);
  const {
    dashboard: apiDashboard,
    ownerQueues,
    evidenceByAlias,
    governanceSystems,
    actions: apiActions,
    notifications
  } = useGovernanceData();

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

  const primaryActions = useMemo(() => primaryApiActions(apiActions), [apiActions]);

  const allQueueRows = useMemo(
    () => buildGlobalOwnerQueueRowsFromApi(ownerQueues, evidenceByAlias),
    [ownerQueues, evidenceByAlias]
  );

  const openRisks = useMemo(
    () =>
      allQueueRows.filter(
        (row) => row.stage !== "Closed" && isDemoAgent(row.systemCanonicalId)
      ),
    [allQueueRows]
  );

  const kpi = useMemo(() => {
    const queueRisks = openRisks.map((row) => ({
      systemId: row.systemCanonicalId ?? "",
      severity: row.severityLabel,
      lifecycle: row.stage
    }));
    const demoCounts = countDemoRisks(queueRisks, isDemoAgent);
    const usingQueues = Object.values(ownerQueues).some((queue) => queue != null);
    const verification = verificationResultCount({
      improved: apiDashboard?.verification_improved,
      followUp: apiDashboard?.verification_follow_up,
      rollback: apiDashboard?.verification_rollback
    });
    return {
      governedAgents: governedSystems.length || GOVERNED_FLEET_SYSTEM_COUNT,
      active: usingQueues ? demoCounts.active : (apiDashboard?.active_incidents ?? 0),
      criticalHigh: usingQueues ? demoCounts.criticalHigh : (apiDashboard?.critical_incidents ?? 0),
      awaitingDecision: apiDashboard?.actions_awaiting_approval ?? 0,
      verification
    };
  }, [apiDashboard, ownerQueues, governedSystems.length, openRisks]);

  const teamStats = useMemo(
    () =>
      PRIMARY_OWNER_TEAMS.map((team) => {
        const rows = openRisks.filter((row) => (row.ownerTeam ?? row.responderTeam) === team);
        return {
          team,
          open: rows.length,
          critical: rows.filter((row) => row.severityLabel.toLowerCase() === "critical").length,
          needsAttention: rows.filter((row) =>
            ["Owner Review", "Action Approval"].includes(row.stage)
          ).length
        };
      }),
    [openRisks]
  );

  const coverage = useMemo(() => {
    const demo = filterDemoAgents(governanceSystems?.items ?? []);
    const total = demo.length;
    return {
      total,
      telemetry: demo.filter((sys) => Boolean(sys.last_signal_at)).length,
      policy: total,
      approval: total,
      source: 0
    };
  }, [governanceSystems]);

  const activity = useMemo(() => {
    return [...notifications]
      .filter((row) => row.status !== "superseded")
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .slice(0, 6);
  }, [notifications]);

  const stepForRisk = useCallback(
    (
      incidentId: string,
      systemCanonicalId: string | undefined,
      stage: string,
      severity?: string,
      ownerTeam?: string,
      evidenceCount?: number
    ) => {
      const action =
        primaryActions.find(
          (row) => row.alias_id === incidentId || row.incident_id === incidentId
        ) ?? primaryActions.find((row) => row.system_id === systemCanonicalId);
      return resolveIncidentLifecycle({
        openIncidents: 1,
        lifecycle: stage,
        actionStatus: action?.status,
        verificationStatus: action?.verification_status,
        resolutionStatus: action?.resolution_status,
        serverStage: action?.current_stage,
        serverLabel: action?.current_stage_label,
        serverStep: action?.next_required_step,
        serverCta: action?.primary_cta,
        serverDestination: action?.primary_destination,
        serverClosure: action?.closure_state,
        actionId: action?.id,
        incidentId,
        severity,
        ownerTeam,
        evidenceCount
      });
    },
    [primaryActions]
  );

  const reviewRiskQueue = useCallback(() => {
    router.push(scopeHref(routes.incidents()));
  }, [router, scopeHref]);

  const showDashboardToast = useCallback((msg: string) => {
    setDashboardToast(msg);
    window.setTimeout(() => setDashboardToast(null), 3000);
  }, []);

  const triageRow = allQueueRows.find((row) => row.incidentId === triageIncidentId) ?? null;

  const openRiskDetail = useCallback(
    (
      incidentId: string | null | undefined,
      canonicalId?: string | null,
      tab: OverviewLoopTab = "evidence"
    ) => {
      const match =
        allQueueRows.find(
          (row) =>
            row.incidentId === incidentId ||
            row.canonicalId === incidentId ||
            row.canonicalId === canonicalId ||
            row.incidentId === canonicalId
        ) ?? null;
      if (match) {
        setTriageTab(tab);
        setTriageIncidentId(match.incidentId);
        return;
      }
      const id = incidentId || canonicalId;
      if (id) router.push(scopeHref(routeToIncident(id)));
    },
    [allQueueRows, router, scopeHref]
  );

  const goToDestination = useCallback(
    (
      dest: NextStepDestination,
      incidentId: string | null | undefined,
      canonicalId?: string | null,
      category?: Parameters<typeof categoryToOverviewKind>[0]
    ) => {
      if (dest.surface === "risk_detail") {
        const kind = category ? categoryToOverviewKind(category) : "risk_detail";
        openRiskDetail(incidentId, canonicalId, drawerTabForOverviewStep(kind));
        return;
      }
      router.push(scopeHref(dest.href));
    },
    [openRiskDetail, router, scopeHref]
  );

  const sendTriageToActionCenter = useCallback(async () => {
    if (!triageRow) return;
    setTriageSending(true);
    const ok = await handoffIncidentToActionCenter(triageRow.incidentId);
    setTriageSending(false);
    showDashboardToast(
      ok
        ? "Handed off for review. Agent code was not changed."
        : "Could not hand off — check API connection"
    );
  }, [triageRow, showDashboardToast]);

  return (
    <section className="space-y-8 pb-8">
      <header className="flex flex-col gap-4 pb-1 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Governance workspace
          </p>
          <h1 className="text-[2rem] font-semibold tracking-tight text-[#1e3a4f] sm:text-4xl">
            Your fleet. Under control.
          </h1>
          <p className="max-w-xl text-[15px] leading-snug text-slate-500">
            Understand the risk. Decide the next step. Verify the outcome.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <GovernanceNotificationBell scopeHref={scopeHref} />
          <button
            type="button"
            onClick={reviewRiskQueue}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800"
          >
            Review risk queue
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </header>

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

      <section className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold tracking-tight text-slate-950">Risks requiring action</h2>
          <p className="mt-1 text-[13px] text-slate-500">
            Open the next step on that incident.
          </p>
        </div>
        {openRisks.length === 0 ? (
          <p className="px-5 py-8 text-[13px] text-slate-500">
            No open risks. Healthy telemetry stays out of this list until a control threshold is
            crossed.
          </p>
        ) : (
          <ul>
            {openRisks.slice(0, 6).map((row, index) => {
              const step = stepForRisk(
                row.incidentId,
                row.systemCanonicalId,
                row.stage,
                row.severityLabel,
                row.ownerTeam ?? row.responderTeam,
                row.evidenceItemsCount
              );
              const tone = triageTone(row.severityLabel);
              return (
                <li
                  key={row.incidentId}
                  className="flex items-center gap-3 border-b border-slate-200 px-5 py-4 last:border-b-0"
                >
                  <span
                    className={cn("h-10 w-1 shrink-0", SEVERITY_BAR[tone])}
                    aria-hidden
                  />
                  <span className="w-6 shrink-0 text-[12px] font-semibold tabular-nums text-slate-400">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      openRiskDetail(row.incidentId, row.canonicalId, "evidence")
                    }
                    className="min-w-0 flex-1 text-left hover:opacity-90"
                  >
                    <span className="block text-[15px] font-semibold text-slate-950">
                      {row.title}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-slate-500">
                      {row.systemName}
                      <span className="text-slate-300"> · </span>
                      {row.responderTeam ?? row.ownerTeam}
                    </span>
                    <span className="mt-1 block text-[12px] text-slate-600">
                      {step.currentStageLabel}
                      <span className="text-slate-300"> · </span>
                      {step.nextRequiredStep}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      goToDestination(
                        step.primaryDestination,
                        row.incidentId,
                        row.canonicalId,
                        step.category
                      )
                    }
                    className="shrink-0 rounded-md bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-slate-800"
                  >
                    {step.primaryCtaLabel}
                  </button>
                  <TriageBadge tone={tone}>{row.severityLabel}</TriageBadge>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-[15px] font-semibold text-slate-950">Owner teams</h2>
            <p className="mt-0.5 text-[12px] text-slate-500">
              Open risks and critical risks by accountable team.
            </p>
          </div>
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 font-semibold">Team</th>
                <th className="px-3 py-2 text-right font-semibold">Open</th>
                <th className="px-3 py-2 text-right font-semibold">Critical</th>
                <th className="px-4 py-2 text-right font-semibold">Needs attention</th>
              </tr>
            </thead>
            <tbody>
              {teamStats.map((row) => (
                <tr key={row.team} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-4 py-3 font-medium text-slate-900">{row.team}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-700">{row.open}</td>
                  <td className="px-3 py-3 text-right">
                    {row.critical > 0 ? (
                      <TriageBadge tone="critical">{row.critical}</TriageBadge>
                    ) : (
                      <span className="tabular-nums text-slate-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {row.needsAttention}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white px-4 py-4">
          <h2 className="text-[15px] font-semibold text-slate-950">Control coverage</h2>
          <p className="mt-0.5 text-[12px] text-slate-500">
            Coverage gaps stay visible even when no risks are open.
          </p>
          <div className="mt-4 space-y-4">
            <CoverageBar
              label="Telemetry connected"
              connected={coverage.telemetry}
              total={coverage.total}
              detail="Agents with a runtime signal in this workspace."
            />
            <CoverageBar
              label="Policy evaluation enabled"
              connected={coverage.policy}
              total={coverage.total}
              detail="Detection rules apply to every governed agent."
            />
            <CoverageBar
              label="Human approval gates"
              connected={coverage.approval}
              total={coverage.total}
              detail="A governed change stays approval-gated. Approval does not change agent code."
            />
            <CoverageBar
              label="Source repository access"
              connected={coverage.source}
              total={coverage.total}
              detail="Not connected. Read-only investigation has no repository to open."
            />
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-[15px] font-semibold text-slate-950">Recent governance activity</h2>
            <p className="mt-0.5 text-[12px] text-slate-500">
              The current step for each risk. Open one to continue the same review.
            </p>
          </div>
          {activity.length === 0 ? (
            <p className="px-4 py-6 text-[13px] text-slate-500">No governance activity recorded yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {activity.map((item) => (
                <ActivityRow
                  key={item.id}
                  item={item}
                  onOpen={() => {
                    const id = item.alias_id || item.incident_id;
                    const action = primaryActions.find(
                      (row) => row.alias_id === id || row.incident_id === id
                    );
                    const step = resolveIncidentLifecycle({
                      incidentId: id,
                      actionId: action?.id,
                      actionStatus: action?.status,
                      verificationStatus: action?.verification_status,
                      resolutionStatus: action?.resolution_status,
                      serverStage: action?.current_stage,
                      serverLabel: action?.current_stage_label,
                      serverStep: action?.next_required_step,
                      serverCta: action?.primary_cta,
                      serverDestination: action?.primary_destination,
                      serverClosure: action?.closure_state,
                      ownerTeam: item.owner_team
                    });
                    goToDestination(step.primaryDestination, id, item.incident_id, step.category);
                  }}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      <RiskTriageDrawer
        open={Boolean(triageRow)}
        row={triageRow}
        evidence={triageRow ? evidenceByAlias[triageRow.incidentId] : null}
        actions={primaryActions}
        scopeHref={scopeHref}
        sending={triageSending}
        onSendToActionCenter={() => void sendTriageToActionCenter()}
        onToast={showDashboardToast}
        onClose={() => setTriageIncidentId(null)}
        initialTab={triageTab}
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

function ActivityRow({ item, onOpen }: { item: NotificationDTO; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {activityLabel(item.kind)}
            </span>
            {item.alias_id ? (
              <span className="font-mono text-[11px] text-slate-400">{item.alias_id}</span>
            ) : null}
          </span>
          <span className="mt-0.5 block text-[13px] leading-snug text-slate-800">{item.message}</span>
        </span>
        <span className="shrink-0 text-[11px] text-slate-400">{formatRelativeTime(item.created_at)}</span>
      </button>
    </li>
  );
}

function CoverageBar({
  label,
  connected,
  total,
  detail
}: {
  label: string;
  connected: number;
  total: number;
  detail: string;
}) {
  const pct = total === 0 ? 0 : Math.round((connected / total) * 100);
  const full = total > 0 && connected >= total;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] font-medium text-slate-800">{label}</p>
        <p className="shrink-0 text-[12px] tabular-nums text-slate-500">
          {connected}/{total || "—"} agents
        </p>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div
          className={cn("h-full rounded-full", full ? "bg-emerald-600" : "bg-emerald-600/80")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] leading-snug text-slate-500">{detail}</p>
    </div>
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
