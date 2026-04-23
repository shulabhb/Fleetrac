import Link from "next/link";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import {
  getAccessPolicy,
  getActions,
  getAuditLogs,
  getBobInvestigationForTarget,
  getChanges,
  getExecutionConsole,
  getIncidents,
  getRules,
  getSystemDetail,
  getSystemOperations,
  getTelemetryEvents
} from "@/lib/api";
import { BobSummaryPanel, BobEmptyPanel } from "@/components/bob/bob-summary-panel";
import { AccessPolicyPanel } from "@/components/actions/access-policy-panel";
import { LinkedActionsPanel } from "@/components/actions/linked-actions";
import { SystemOperationsPanel } from "@/components/operations/system-operations-panel";
import { SystemHero } from "@/components/systems/system-hero";
import { TelemetryTile } from "@/components/systems/telemetry-tile";
import { ChangesTimeline } from "@/components/operations/change-impact";
import { ExecutionConsole } from "@/components/operations/execution-console";
import { ActivityFeed } from "@/components/activity-feed";
import { Card, CardHeader } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import {
  humanizeLabel,
  severityBadgeClasses,
  severityRank,
  signalColor,
  signalTypeForField
} from "@/lib/present";
import { formatInteger, formatRelativeTime } from "@/lib/format";
import {
  routes,
  routeToBobForTarget,
  routeToControl,
  routeToIncident,
  routeToIncidentsForSystem,
  routeToOutcomesForSystem
} from "@/lib/routes";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function SystemDetailPage({ params }: Props) {
  const { id } = await params;
  const [
    { item: system },
    incidentsRes,
    telemetryRes,
    auditRes,
    rulesRes,
    bobRes,
    policyRes,
    actionsRes,
    opsRes,
    changesRes,
    consoleRes
  ] = await Promise.all([
    getSystemDetail(id),
    getIncidents(),
    getTelemetryEvents(`?system_id=${id}&limit=120`),
    getAuditLogs(),
    getRules(),
    getBobInvestigationForTarget("system", id).catch(() => ({ item: null })),
    getAccessPolicy(id).catch(() => ({ item: null as any })),
    getActions({ target_system_id: id }).catch(() => ({ items: [] as any[] })),
    getSystemOperations(id).catch(() => ({ item: null as any })),
    getChanges({ target_system_id: id }).catch(() => ({ items: [] as any[] })),
    getExecutionConsole({ target_system_id: id, limit: 20 }).catch(() => ({
      items: [] as any[]
    }))
  ]);
  const bobInvestigation = bobRes?.item ?? null;
  const accessPolicy = policyRes?.item ?? null;
  const systemActions = actionsRes?.items ?? [];
  const ops = opsRes?.item ?? null;
  const changes = changesRes?.items ?? [];
  const consoleEntries = consoleRes?.items ?? [];

  const incidents = incidentsRes.items.filter((item: any) => item.system_id === id);
  const openIncidents = incidents.filter((item: any) => item.incident_status !== "closed");
  const recentIncidents = incidents.slice(0, 6);
  const telemetry = telemetryRes.items;
  const chronologicalTelemetry = [...telemetry].reverse();

  const driftSeries = chronologicalTelemetry.map((t: any) => ({
    t: t.timestamp,
    v: t.drift_index
  }));
  const latencySeries = chronologicalTelemetry.map((t: any) => ({
    t: t.timestamp,
    v: t.latency_p95_ms
  }));
  const groundingSeries = chronologicalTelemetry.map((t: any) => ({
    t: t.timestamp,
    v: t.grounding_score
  }));
  const auditSeries = chronologicalTelemetry.map((t: any) => ({
    t: t.timestamp,
    v: t.audit_coverage_pct
  }));

  const latestEvent = chronologicalTelemetry[chronologicalTelemetry.length - 1];

  // Surface a rich mix of audit events scoped to this system.
  const incidentIds = new Set(incidents.map((item: any) => item.id));
  const telemetryIds = new Set(telemetry.map((t: any) => t.id));
  const ruleIdsUsedOnSystem = new Set(incidents.map((i: any) => i.rule_id));
  const seenKeys = new Set<string>();
  const activityItems = auditRes.items
    .filter((entry: any) => {
      if (entry.action === "telemetry.processed") return false;
      if (incidentIds.has(entry.target_id)) return true;
      if (entry.target_type === "telemetry_event" && telemetryIds.has(entry.target_id))
        return true;
      if (entry.target_type === "control" && ruleIdsUsedOnSystem.has(entry.target_id))
        return true;
      if (
        entry.details &&
        entry.details.toLowerCase().includes(id.toLowerCase())
      )
        return true;
      return false;
    })
    .filter((entry: any) => {
      const k = `${entry.action}::${entry.target_id}::${(entry.details ?? "").slice(0, 50)}`;
      if (seenKeys.has(k)) return false;
      seenKeys.add(k);
      return true;
    })
    .slice(0, 12)
    .map((e: any) => ({
      id: e.id,
      action: e.action,
      details: e.details,
      timestamp: e.timestamp,
      targetType: e.target_type,
      targetId: e.target_id
    }));

  const triggeredRuleIds = new Set(incidents.map((item: any) => item.rule_id));
  const incidentsByRule = incidents.reduce((acc: Record<string, any[]>, inc: any) => {
    (acc[inc.rule_id] ??= []).push(inc);
    return acc;
  }, {});

  // Classify controls into recently triggered (last 7d) and monitoring coverage.
  const nowMs = Date.now();
  const within7d = 7 * 24 * 60 * 60 * 1000;
  const recentlyTriggered = rulesRes.items
    .filter((rule: any) => {
      const incs = incidentsByRule[rule.id] ?? [];
      return incs.some((i: any) => nowMs - new Date(i.created_at).getTime() <= within7d);
    })
    .slice(0, 8);
  const coveringControls = rulesRes.items
    .filter((rule: any) => triggeredRuleIds.has(rule.id) && !recentlyTriggered.includes(rule))
    .slice(0, 8);

  const highestSeverity = ["high", "medium", "low"].find((sev) =>
    openIncidents.some((i: any) => i.severity === sev)
  ) as "high" | "medium" | "low" | undefined;

  // Identify actions that were the source of rollback-candidate changes on this
  // system, so LinkedActionsPanel can surface a "Rollback candidates" pill.
  const rollbackActionIds = new Set<string>(
    changes
      .filter(
        (c: any) =>
          c.impact_status === "rollback_candidate" && typeof c.source_action_id === "string"
      )
      .map((c: any) => c.source_action_id as string)
  );

  return (
    <section className="space-y-5">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link
          href={routes.systems()}
          className="inline-flex items-center gap-1 hover:text-slate-900"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to Systems
        </Link>
      </div>

      <SystemHero
        system={system}
        ops={ops}
        openIncidentCount={openIncidents.length}
        highestOpenSeverity={highestSeverity}
        bobInvestigationId={bobInvestigation?.id ?? null}
      />

      {/* Bob System Analysis — the structural read */}
      <section>
        <header className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="label-eyebrow text-indigo-700">Bob system analysis</p>
            <h3 className="mt-0.5 text-sm font-semibold tracking-tight text-slate-900">
              Structural read of this system
            </h3>
          </div>
          <p className="max-w-md text-[11px] text-slate-500">
            Recurrence, likely root cause, and next approval-gated remediation.
          </p>
        </header>
        {bobInvestigation ? (
          <BobSummaryPanel investigation={bobInvestigation} variant="compact" />
        ) : (
          <BobEmptyPanel targetType="system" targetId={system.id} />
        )}
      </section>

      {/* Operations state — versioning, maintenance, rollback */}
      {ops ? <SystemOperationsPanel ops={ops} /> : null}

      {/* Access & action policy (trust surface) + governed actions sidecar */}
      {accessPolicy ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <AccessPolicyPanel policy={accessPolicy} />
          <LinkedActionsPanel
            actions={systemActions}
            title="Governed actions on this system"
            caption="Routed through the Action Center, bounded by the policy on the left."
            rollbackActionIds={rollbackActionIds}
            emptyLabel={
              openIncidents.length === 0
                ? "Healthy — no governed actions open. Any future recurrence routes here for approval."
                : "No governed actions yet. Bob's remediations will appear here with approval and execution state."
            }
          />
        </div>
      ) : null}

      {/* Changes & Impact — what actually changed, did it help? */}
      <Card>
        <CardHeader
          title="Changes & impact"
          caption="Governed changes executed here. Expected vs. actual on monitored metrics."
          action={
            changes.length > 0 ? (
              <Link
                href={routeToOutcomesForSystem(id)}
                className="text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                View all outcomes →
              </Link>
            ) : null
          }
        />
        <div className="mt-3">
          <ChangesTimeline
            changes={changes.slice(0, 5)}
          emptyLabel={
            openIncidents.length === 0
              ? "No governed changes in this window. Operating within policy."
              : "No governed changes yet. Approved Bob recommendations will appear here with measured impact."
          }
          />
          {changes.length > 5 ? (
            <div className="mt-3 text-center">
              <Link
                href={routeToOutcomesForSystem(id)}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:border-slate-300"
              >
                See all {changes.length} outcomes for this system →
              </Link>
            </div>
          ) : null}
        </div>
      </Card>

      {consoleEntries.length > 0 ? (
        <ExecutionConsole
          entries={consoleEntries}
          title="Execution console · this system"
          caption="Audit-linked operational acts Bob has prepared or executed."
        />
      ) : null}

      {/* Telemetry evidence + recent incidents */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Telemetry trends"
            caption={
              latestEvent
                ? `Last ingested ${formatRelativeTime(latestEvent.timestamp)} · ${formatInteger(telemetry.length)} events`
                : "Awaiting first telemetry event"
            }
            action={
              <InfoTooltip
                content="Computed from recent telemetry events. Dashed lines mark the governance review threshold for each control."
                ariaLabel="About telemetry trends"
              />
            }
          />
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <TelemetryTile
              label="Drift index"
              threshold="Review above 0.25"
              data={driftSeries}
              thresholdValue={0.25}
              thresholdLabel="Review"
              color="#0f172a"
              yDigits={3}
            />
            <TelemetryTile
              label="Latency p95"
              threshold="SLA at 1500 ms"
              data={latencySeries}
              thresholdValue={1500}
              thresholdLabel="SLA"
              color="#0369a1"
              unit=" ms"
              yDigits={0}
            />
            <TelemetryTile
              label="Grounding score"
              threshold="Alert below 0.7"
              data={groundingSeries}
              thresholdValue={0.7}
              thresholdLabel="Alert"
              color="#7c3aed"
              yDigits={2}
            />
            <TelemetryTile
              label="Audit coverage"
              threshold="Regulatory floor 95%"
              data={auditSeries}
              thresholdValue={95}
              thresholdLabel="Floor"
              color="#047857"
              unit="%"
              yDigits={1}
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Recent incidents"
            caption={`${openIncidents.length} open · ${incidents.length} total`}
            action={
              <Link
                href={routeToIncidentsForSystem(id)}
                className="text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                View all →
              </Link>
            }
          />
          {recentIncidents.length === 0 ? (
            <div className="mt-4 rounded-md border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
              No incidents recorded. Controls below are actively monitoring.
            </div>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100">
              {recentIncidents
                .sort((a: any, b: any) => severityRank(b.severity) - severityRank(a.severity))
                .map((incident: any) => (
                  <li key={incident.id}>
                    <Link
                      href={routeToIncident(incident.id)}
                      className="group flex items-start justify-between gap-3 py-2.5 transition hover:bg-slate-50/60"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${severityBadgeClasses(incident.severity)}`}
                          >
                            {humanizeLabel(incident.severity)}
                          </span>
                          <p className="truncate text-sm font-medium text-slate-900">
                            {incident.title}
                          </p>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {humanizeLabel(incident.incident_status)}
                          <span className="mx-1.5 text-slate-300">·</span>
                          {humanizeLabel(incident.escalation_status)}
                          <span className="mx-1.5 text-slate-300">·</span>
                          {formatRelativeTime(incident.created_at)}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Governance activity + active controls */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Recent governance activity"
            caption="Audit events scoped to this system"
          />
          <div className="mt-3">
            {activityItems.length === 0 ? (
              <p className="text-sm text-slate-500">
                No governance activity in this window.
              </p>
            ) : (
              <ActivityFeed
                items={activityItems}
                hrefFor={(item) => {
                  if (!item.targetId) return null;
                  if (item.action?.startsWith("bob.") && item.targetType === "control") {
                    return routeToBobForTarget("control", item.targetId);
                  }
                  if (item.action?.startsWith("bob.") && item.targetType === "incident") {
                    return routeToBobForTarget("incident", item.targetId);
                  }
                  if (item.targetId.startsWith("inc_"))
                    return routeToIncident(item.targetId);
                  if (item.targetId.startsWith("rule_"))
                    return routeToControl(item.targetId);
                  return null;
                }}
              />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Active controls on this system"
            caption="Currently monitoring — recently triggered first."
          />
          <div className="mt-4 space-y-4">
            <ControlGroup
              label="Recently triggered (last 7 days)"
              emptyLabel="No control has triggered in the last 7 days."
              rules={recentlyTriggered}
              incidentsByRule={incidentsByRule}
              highlight
            />
            <ControlGroup
              label="Monitoring coverage"
              emptyLabel="All previously-triggering controls are quiet. Fleet-wide controls still apply."
              rules={coveringControls}
              incidentsByRule={incidentsByRule}
            />
          </div>
        </Card>
      </div>
    </section>
  );
}

function ControlGroup({
  label,
  emptyLabel,
  rules,
  incidentsByRule,
  highlight
}: {
  label: string;
  emptyLabel: string;
  rules: any[];
  incidentsByRule: Record<string, any[]>;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="label-eyebrow">{label}</p>
      {rules.length === 0 ? (
        <p className="mt-1 text-xs text-slate-500">{emptyLabel}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {rules.map((rule: any) => {
            const incs = incidentsByRule[rule.id] ?? [];
            const lastTriggered = incs[0]?.created_at;
            const signal = signalTypeForField(rule.observed_field);
            return (
              <li
                key={rule.id}
                className="rounded-md border border-slate-200 bg-white px-3 py-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
                      <p className="truncate text-sm font-medium text-slate-900">
                        {rule.name}
                      </p>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${signalColor(signal)}`}
                      >
                        {signal}
                      </span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${severityBadgeClasses(rule.severity)}`}
                      >
                        {humanizeLabel(rule.severity)}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">
                      {rule.description}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-[11px] text-slate-500">
                    <p className="tabular-nums font-semibold text-slate-900">
                      {incs.length} {incs.length === 1 ? "fire" : "fires"}
                    </p>
                    {highlight && lastTriggered ? (
                      <p>{formatRelativeTime(lastTriggered)}</p>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
