import { FileText, GaugeCircle } from "lucide-react";
import { TrendChart } from "@/components/charts/trend-chart";
import { Card, CardHeader } from "@/components/ui/card";
import {
  getActions,
  getBobInvestigationForTarget,
  getIncidentDetail,
  getTelemetryEvents
} from "@/lib/api";
import { BobSummaryPanel, BobEmptyPanel } from "@/components/bob/bob-summary-panel";
import { LinkedActionsPanel } from "@/components/actions/linked-actions";
import { DisclosureSection } from "@/components/shared/disclosure-section";
import { IncidentDetailHero } from "@/components/incident-detail-hero";
import { IncidentDetailDecisionLayer } from "@/components/incident-detail-decision-layer";
import { IncidentDetailActivityFeed } from "@/components/incident-detail-activity-feed";
import { IncidentOperatorSurface } from "@/components/incident-operator-surface";
import { formatMetric, formatRelativeTime } from "@/lib/format";
import { humanizeLabel, metricLabel, signalTypeForField, telemetryFieldForMetric } from "@/lib/present";
import {
  appendReturnTo,
  routes,
  routeToAction,
  routeToBobForTarget,
  routeToBobInvestigation,
  routeToControl
} from "@/lib/routes";

type IncidentDetailPageProps = {
  params: Promise<{ id: string }>;
};

function parseThreshold(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  const match = String(value).match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function metricColor(signal: string): string {
  switch (signal) {
    case "Drift":
      return "#7c3aed";
    case "Latency":
      return "#0369a1";
    case "Grounding":
      return "#4338ca";
    case "Quality":
      return "#0891b2";
    case "Policy":
      return "#b45309";
    case "Security":
      return "#be123c";
    case "Audit":
      return "#475569";
    case "Cost":
      return "#0d9488";
    default:
      return "#0f172a";
  }
}

export default async function IncidentDetailPage({ params }: IncidentDetailPageProps) {
  const { id } = await params;
  const here = `/incidents/${id}`;
  const [detail, bobRes, actionsRes] = await Promise.all([
    getIncidentDetail(id),
    getBobInvestigationForTarget("incident", id).catch(() => ({ item: null })),
    getActions({ related_incident_id: id }).catch(() => ({ items: [] as any[] }))
  ]);
  const investigation = bobRes?.item ?? null;
  const incidentActions = actionsRes?.items ?? [];
  const { incident, telemetry_context, audit_entries } = detail;
  const telemetryRes = await getTelemetryEvents(
    `?system_id=${incident.system_id}&limit=80`
  );

  // Chart data: find the triggered metric's series for this system.
  const metricField =
    telemetryFieldForMetric(incident.trigger_metric) ??
    telemetryFieldForMetric(incident.rule_id);
  const chronological = [...(telemetryRes.items ?? [])].reverse();
  const series = metricField
    ? chronological.map((t: any) => ({ t: t.timestamp, v: t[metricField] }))
    : [];
  const signalType = signalTypeForField(metricField ?? incident.trigger_metric);
  const thresholdNumber = parseThreshold(incident.threshold);
  const observedNumber =
    typeof incident.observed_value === "number"
      ? incident.observed_value
      : parseThreshold(incident.observed_value);

  // Supporting metrics from telemetry context
  const supportingMetrics: { key: string; label: string; value: any; unit?: string }[] =
    telemetry_context
      ? [
          {
            key: "latency_p95_ms",
            label: "Latency p95",
            value: telemetry_context.latency_p95_ms,
            unit: "ms"
          },
          { key: "drift_index", label: "Drift Index", value: telemetry_context.drift_index },
          {
            key: "grounding_score",
            label: "Grounding Score",
            value: telemetry_context.grounding_score
          },
          {
            key: "audit_coverage_pct",
            label: "Audit Coverage",
            value: telemetry_context.audit_coverage_pct,
            unit: "%"
          },
          {
            key: "policy_violation_rate",
            label: "Policy Violation Rate",
            value: telemetry_context.policy_violation_rate
          },
          {
            key: "error_pct",
            label: "Error Rate",
            value: telemetry_context.error_pct,
            unit: "%"
          }
        ].filter((m) => metricField !== m.key && m.value != null)
      : [];

  const activityItems = (audit_entries ?? []).map((entry: any) => ({
    id: entry.id,
    action: entry.action,
    details: entry.details,
    timestamp: entry.timestamp,
    actor: entry.actor,
    targetId: entry.target_id
  }));

  const firstAction = incidentActions[0] ?? null;

  return (
    <section className="space-y-5">
      <IncidentOperatorSurface
        incidentId={incident.id}
        systemId={incident.system_id}
        ruleId={incident.rule_id}
        showWorkspaceShortcuts={false}
      />

      <h1 className="text-lg font-semibold leading-snug text-slate-900">{incident.title}</h1>

      <IncidentDetailHero
        recommendedAction={incident.recommended_action}
        investigationHref={
          investigation
            ? appendReturnTo(routeToBobInvestigation(investigation.id), here)
            : appendReturnTo(routeToBobForTarget("incident", incident.id), here)
        }
        hasInvestigation={Boolean(investigation)}
        actionHref={
          firstAction ? appendReturnTo(routeToAction(firstAction.id), here) : routes.actions()
        }
        hasGovernedAction={Boolean(firstAction)}
        createdAt={incident.created_at}
        incidentStatus={incident.incident_status}
        reviewRequired={incident.review_required}
        escalationStatus={incident.escalation_status}
      />

      <div className="space-y-4">
        <IncidentDetailDecisionLayer
            incident={{
              id: incident.id,
              title: incident.title,
              owner_team: incident.owner_team,
              system_id: incident.system_id
            }}
            initialIncidentStatus={incident.incident_status}
            initialEscalationStatus={incident.escalation_status}
            initialReviewRequired={incident.review_required}
            investigationHref={
              investigation
                ? appendReturnTo(routeToBobInvestigation(investigation.id), here)
                : appendReturnTo(routeToBobForTarget("incident", incident.id), here)
            }
            actionHref={
              firstAction ? appendReturnTo(routeToAction(firstAction.id), here) : routes.actions()
            }
            activityInitialItems={activityItems}
          />

          <DisclosureSection
            defaultOpen
            eyebrow="Investigate · Act"
            title="Bob analysis and governed actions"
            summary={
              investigation
                ? "Bob investigation available with root-cause support and governed action links."
                : "No Bob investigation yet. Start analysis when operator triage is complete."
            }
          >
            <div className="space-y-3">
              {investigation ? (
                <BobSummaryPanel investigation={investigation} variant="compact" className="shadow-none" />
              ) : (
                <BobEmptyPanel targetType="incident" targetId={incident.id} />
              )}
              <LinkedActionsPanel
                actions={incidentActions}
                title="Governed actions from this incident"
                caption="Remediations Bob drafted, with approver, eligibility, and monitoring state."
              />
            </div>
          </DisclosureSection>

          <Card surface="evidence" className="border-slate-200">
            <CardHeader
              title="Evidence"
              caption={
                metricField
                  ? `${metricLabel(metricField)} · ${incident.system_name}`
                  : "Breach evidence and supporting metrics."
              }
              action={<GaugeCircle className="h-4 w-4 text-slate-400" />}
            />

          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="rounded-md border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="label-eyebrow">Triggered metric</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">
                  {metricLabel(metricField)}
                </p>
              </div>
              <div className="flex items-center gap-3 text-right text-xs">
                <div>
                  <p className="label-eyebrow">Observed</p>
                  <p className="tabular-nums text-base font-semibold text-rose-700">
                    {observedNumber != null ? formatMetric(observedNumber, { digits: 3 }) : "—"}
                  </p>
                </div>
                <div>
                  <p className="label-eyebrow">Threshold</p>
                  <p className="tabular-nums text-base font-semibold text-slate-700">
                    {thresholdNumber != null
                      ? formatMetric(thresholdNumber, { digits: 3 })
                      : incident.threshold ?? "—"}
                  </p>
                </div>
                {incident.expected_value != null ? (
                  <div>
                    <p className="label-eyebrow">Expected</p>
                    <p className="tabular-nums text-base font-semibold text-slate-700">
                      {formatMetric(incident.expected_value, { digits: 3 })}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="mt-3">
              <TrendChart
                data={series}
                threshold={thresholdNumber ?? undefined}
                thresholdLabel={
                  thresholdNumber != null ? `Threshold ${formatMetric(thresholdNumber, { digits: 3 })}` : undefined
                }
                color={metricColor(signalType)}
                height={200}
                yDigits={
                  metricField === "latency_p95_ms"
                    ? 0
                    : metricField === "audit_coverage_pct"
                      ? 1
                      : 3
                }
              />
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Dashed line is the governance threshold. The latest value triggered this incident.
            </p>
          </div>

          <div className="space-y-3">
            <div className="rounded-md border border-slate-200 bg-white p-3">
              <p className="label-eyebrow">Breach context</p>
              <p className="mt-2 text-sm text-slate-700">{incident.summary}</p>
              <p className="mt-2 text-[11px] text-slate-500">
                Event timestamp:{" "}
                {telemetry_context
                  ? formatRelativeTime(telemetry_context.timestamp)
                  : "—"}
              </p>
            </div>
            <DisclosureSection
              title="Supporting metrics"
              summary={
                supportingMetrics.length > 0
                  ? `${supportingMetrics.length} additional telemetry signals`
                  : "No additional telemetry captured in this window."
              }
              className="border-slate-200 bg-white"
              bodyClassName="p-3"
            >
              {supportingMetrics.length > 0 ? (
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
                  {supportingMetrics.map((metric) => (
                    <div key={metric.key} className="min-w-0">
                      <dt className="truncate text-[11px] text-slate-500">{metric.label}</dt>
                      <dd className="tabular-nums text-sm font-semibold text-slate-900">
                        {formatMetric(metric.value, {
                          digits: 2,
                          unit: metric.unit ? ` ${metric.unit}` : ""
                        })}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-xs text-slate-500">No additional telemetry captured in this window.</p>
              )}
            </DisclosureSection>
          </div>
        </div>
          </Card>

          <DisclosureSection
            eyebrow="Audit · deep detail"
            title="Governance context and record"
            summary={`${activityItems.length} audit entries · ${incident.owner_team} ownership · ${humanizeLabel(incident.risk_category)} risk domain`}
            defaultOpen={false}
          >
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <Card surface="audit">
                <CardHeader
                  title="Business & governance context"
                  caption="Organizational exposure if left untreated."
                  action={<FileText className="h-4 w-4 text-slate-400" />}
                />
                <p className="mt-3 text-sm leading-relaxed text-slate-700">
                  Affects governance confidence for a production AI workflow owned by{" "}
                  <span className="font-medium text-slate-900">{incident.owner_team}</span>.
                  Untreated, it increases policy exposure, review burden, and stakeholder risk in
                  regulated decision flows.
                </p>
                <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                  <p>
                    <span className="text-slate-400">Risk domain:</span>{" "}
                    <span className="font-medium text-slate-800">
                      {humanizeLabel(incident.risk_category)}
                    </span>
                  </p>
                  <p>
                    <span className="text-slate-400">Owner team:</span>{" "}
                    <span className="font-medium text-slate-800">{incident.owner_team}</span>
                  </p>
                </div>
              </Card>
              <Card surface="audit">
                <CardHeader title="Audit trail" caption="Actions recorded for this incident." />
                <div className="mt-3">
                  <IncidentDetailActivityFeed incidentId={incident.id} initialItems={activityItems} />
                </div>
              </Card>
            </div>
          </DisclosureSection>
      </div>
    </section>
  );
}
