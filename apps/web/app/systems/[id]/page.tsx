import Link from "next/link";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import {
  getAuditLogs,
  getBobInvestigationForTarget,
  getIncidents,
  getRules,
  getSystemDetail,
  getTelemetryEvents
} from "@/lib/api";
import { BobSummaryPanel, BobEmptyPanel } from "@/components/bob/bob-summary-panel";
import { ActivityFeed } from "@/components/activity-feed";
import { TrendChart } from "@/components/charts/trend-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { SectionTitle } from "@/components/ui/section-title";
import {
  humanizeLabel,
  metricLabel,
  postureBadgeClasses,
  severityBadgeClasses,
  severityRank,
  signalColor,
  signalTypeForField
} from "@/lib/present";
import { formatInteger, formatMetric, formatRelativeTime } from "@/lib/format";

type Props = {
  params: Promise<{ id: string }>;
};

function postureTone(posture: string): "high" | "medium" | "low" | "neutral" {
  if (posture === "critical" || posture === "at_risk") return "high";
  if (posture === "watch") return "medium";
  if (posture === "healthy") return "low";
  return "neutral";
}

export default async function SystemDetailPage({ params }: Props) {
  const { id } = await params;
  const [{ item: system }, incidentsRes, telemetryRes, auditRes, rulesRes, bobRes] =
    await Promise.all([
      getSystemDetail(id),
      getIncidents(),
      getTelemetryEvents(`?system_id=${id}&limit=120`),
      getAuditLogs(),
      getRules(),
      getBobInvestigationForTarget("system", id).catch(() => ({ item: null }))
    ]);
  const bobInvestigation = bobRes?.item ?? null;

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

  // Surface a rich mix of audit events scoped to this system: incident
  // lifecycle, control triggers, Bob investigation events, follow-ups, and
  // audit-floor breaches from its telemetry.
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

  const displayName = `${system.use_case} (${system.model})`;

  return (
    <section className="space-y-5">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link
          href="/systems"
          className="inline-flex items-center gap-1 hover:text-slate-900"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to Systems
        </Link>
      </div>

      <Card className="p-0">
        <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="min-w-0">
            <p className="label-eyebrow">System</p>
            <h2 className="mt-1 truncate text-xl font-semibold tracking-tight text-slate-900">
              {displayName}
            </h2>
            <p className="mt-0.5 text-xs font-mono uppercase tracking-wide text-slate-400">
              {system.id}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={postureTone(system.risk_posture)} dot size="sm">
              {humanizeLabel(system.risk_posture)}
            </Badge>
            {highestSeverity ? (
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${severityBadgeClasses(highestSeverity)}`}
              >
                {humanizeLabel(highestSeverity)} open
              </span>
            ) : (
              <Badge tone="low" size="sm">
                No open issues
              </Badge>
            )}
            {bobInvestigation ? (
              <Link
                href={`/bob/${bobInvestigation.id}`}
                className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 ring-1 ring-indigo-200 transition hover:bg-indigo-100"
              >
                Bob review open →
              </Link>
            ) : null}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-px border-t border-slate-200 bg-slate-200 text-sm md:grid-cols-4">
          {[
            ["Owner", system.owner],
            ["Control Owner", system.control_owner],
            ["Business Function", system.business_function],
            ["Regulatory Sensitivity", humanizeLabel(system.regulatory_sensitivity)],
            ["Deployment Scope", humanizeLabel(system.deployment_scope)],
            ["Environment", humanizeLabel(system.environment)],
            ["Model Type", humanizeLabel(system.model_type)],
            ["Open Incidents", formatInteger(openIncidents.length)]
          ].map(([label, value]) => (
            <div key={label as string} className="bg-white px-5 py-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
              <p className="mt-0.5 truncate text-sm text-slate-800">{value || "—"}</p>
            </div>
          ))}
        </dl>
        {(system.hosting_environment ||
          system.integration_mode ||
          system.telemetry_coverage != null ||
          system.connection_status) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-100 bg-slate-50/60 px-5 py-2.5 text-[11px] text-slate-500">
            {system.hosting_environment ? (
              <span>
                <span className="text-slate-400">Hosting:</span>{" "}
                <span className="font-medium text-slate-700">
                  {system.hosting_environment}
                </span>
              </span>
            ) : null}
            {system.integration_mode ? (
              <span>
                <span className="text-slate-400">Integration:</span>{" "}
                <span className="font-medium text-slate-700">
                  {system.integration_mode}
                </span>
              </span>
            ) : null}
            {system.telemetry_coverage != null ? (
              <span>
                <span className="text-slate-400">Telemetry coverage:</span>{" "}
                <span className="font-medium text-slate-700">
                  {Math.round(system.telemetry_coverage)}%
                </span>
              </span>
            ) : null}
            {system.connection_status ? (
              <span className="inline-flex items-center gap-1">
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    system.connection_status === "connected"
                      ? "bg-emerald-500"
                      : system.connection_status === "degraded"
                      ? "bg-amber-500"
                      : "bg-slate-400"
                  }`}
                />
                <span className="font-medium text-slate-700">
                  {humanizeLabel(system.connection_status)}
                </span>
              </span>
            ) : null}
          </div>
        )}
      </Card>

      <section>
        <header className="mb-2 flex items-center justify-between">
          <p className="label-eyebrow flex items-center gap-1.5 text-indigo-700">
            Bob System Analysis
          </p>
          <p className="text-[11px] text-slate-500">
            Bob&apos;s structural read of this system — recurring patterns, stability,
            suggested stabilization path.
          </p>
        </header>
        {bobInvestigation ? (
          <BobSummaryPanel investigation={bobInvestigation} variant="compact" />
        ) : (
          <BobEmptyPanel targetType="system" targetId={system.id} />
        )}
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Telemetry Trends"
            caption={
              latestEvent
                ? `Last ingested ${formatRelativeTime(latestEvent.timestamp)} · ${formatInteger(telemetry.length)} events`
                : "Awaiting first telemetry event"
            }
            action={
              <InfoTooltip
                content="Trends are computed from the most recent telemetry events ingested for this system. Dashed lines mark governance review thresholds for the corresponding control."
                ariaLabel="About telemetry trends"
              />
            }
          />
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <TrendTile
              label="Drift Index"
              caption="Review above 0.25"
              data={driftSeries}
              threshold={0.25}
              thresholdLabel="Review"
              color="#0f172a"
              yDigits={3}
            />
            <TrendTile
              label="Latency p95"
              caption="SLA at 1500 ms"
              data={latencySeries}
              threshold={1500}
              thresholdLabel="SLA"
              color="#0369a1"
              unit=" ms"
              yDigits={0}
            />
            <TrendTile
              label="Grounding Score"
              caption="Alert below 0.7"
              data={groundingSeries}
              threshold={0.7}
              thresholdLabel="Alert"
              color="#7c3aed"
              yDigits={2}
            />
            <TrendTile
              label="Audit Coverage"
              caption="Regulatory floor 95%"
              data={auditSeries}
              threshold={95}
              thresholdLabel="Floor"
              color="#047857"
              unit="%"
              yDigits={1}
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Recent Incidents"
            caption={`${openIncidents.length} open · ${incidents.length} total`}
            action={
              <Link
                href={`/incidents?system=${id}`}
                className="text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                View all →
              </Link>
            }
          />
          {recentIncidents.length === 0 ? (
            <div className="mt-4 rounded-md border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
              No incidents recorded for this system. Controls below are actively monitoring its telemetry.
            </div>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100">
              {recentIncidents
                .sort((a: any, b: any) => severityRank(b.severity) - severityRank(a.severity))
                .map((incident: any) => (
                  <li key={incident.id}>
                    <Link
                      href={`/incidents/${incident.id}`}
                      className="group flex items-start justify-between gap-3 py-2.5"
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
                          {humanizeLabel(incident.incident_status)} ·{" "}
                          {humanizeLabel(incident.escalation_status)} ·{" "}
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

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Recent Governance Activity"
            caption="Audit events tied to this system"
          />
          <div className="mt-3">
            {activityItems.length === 0 ? (
              <p className="text-sm text-slate-500">
                No governance activity logged for this system in the current window.
              </p>
            ) : (
              <ActivityFeed
                items={activityItems}
                hrefFor={(item) => {
                  if (!item.targetId) return null;
                  if (item.action?.startsWith("bob.") && item.targetType === "control") {
                    return `/bob/for/control/${item.targetId}`;
                  }
                  if (item.action?.startsWith("bob.") && item.targetType === "incident") {
                    return `/bob/for/incident/${item.targetId}`;
                  }
                  if (item.targetId.startsWith("inc_")) return `/incidents/${item.targetId}`;
                  if (item.targetId.startsWith("rule_")) return `/controls`;
                  return null;
                }}
              />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Active Controls Affecting This System"
            caption="Controls currently monitoring or recently triggered"
          />
          <div className="mt-4 space-y-4">
            <ControlGroup
              label="Recently triggered"
              emptyLabel="No control has triggered in the last 7 days."
              rules={recentlyTriggered}
              incidentsByRule={incidentsByRule}
              highlight
            />
            <ControlGroup
              label="Coverage (not recently triggered)"
              emptyLabel="All previously-triggering controls are quiet. This system is also covered by fleet-wide controls."
              rules={coveringControls}
              incidentsByRule={incidentsByRule}
            />
          </div>
        </Card>
      </div>
    </section>
  );
}

function TrendTile({
  label,
  caption,
  data,
  threshold,
  thresholdLabel,
  color,
  unit,
  yDigits
}: {
  label: string;
  caption: string;
  data: { t: string | number | Date; v: number | null }[];
  threshold?: number;
  thresholdLabel?: string;
  color: string;
  unit?: string;
  yDigits?: number;
}) {
  const values = data.map((d) => d.v).filter((v): v is number => v != null);
  const last = values[values.length - 1];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="text-[11px] text-slate-500">{caption}</p>
        </div>
        <p className="tabular-nums text-lg font-semibold text-slate-900">
          {last != null ? formatMetric(last, { digits: yDigits, unit }) : "—"}
        </p>
      </div>
      <div className="mt-2">
        <TrendChart
          data={data}
          threshold={threshold}
          thresholdLabel={thresholdLabel}
          color={color}
          unit={unit}
          height={96}
          showXAxis={false}
          yDigits={yDigits}
        />
      </div>
    </div>
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
        <ul className="mt-2 space-y-2">
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
                    <div className="flex flex-wrap items-center gap-2">
                      <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
                      <p className="truncate text-sm font-medium text-slate-900">{rule.name}</p>
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
                    <p className="mt-0.5 text-[11px] text-slate-500">{rule.description}</p>
                  </div>
                  <div className="shrink-0 text-right text-[11px] text-slate-500">
                    <p className="tabular-nums font-semibold text-slate-900">
                      {incs.length} fires
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
