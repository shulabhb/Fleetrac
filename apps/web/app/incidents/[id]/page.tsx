import Link from "next/link";
import { ChevronLeft, FileText, GaugeCircle } from "lucide-react";
import { IncidentWorkflowPanel } from "@/components/incident-workflow-panel";
import { ActivityFeed } from "@/components/activity-feed";
import { TrendChart } from "@/components/charts/trend-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { SectionTitle } from "@/components/ui/section-title";
import {
  getBobInvestigationForTarget,
  getIncidentDetail,
  getIncidents,
  getTelemetryEvents
} from "@/lib/api";
import { BobSummaryPanel, BobEmptyPanel } from "@/components/bob/bob-summary-panel";
import { formatInteger, formatMetric, formatRelativeTime } from "@/lib/format";
import {
  humanizeLabel,
  metricLabel,
  severityBadgeClasses,
  signalColor,
  signalTypeForField,
  telemetryFieldForMetric
} from "@/lib/present";

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
  const [detail, incidentsRes, bobRes] = await Promise.all([
    getIncidentDetail(id),
    getIncidents(),
    getBobInvestigationForTarget("incident", id).catch(() => ({ item: null }))
  ]);
  const investigation = bobRes?.item ?? null;
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

  const similarLast7Days = incidentsRes.items.filter((item: any) => {
    if (item.id === incident.id) return false;
    const created = new Date(item.created_at).getTime();
    const ageMs = Date.now() - created;
    const within7Days = ageMs <= 7 * 24 * 60 * 60 * 1000;
    return within7Days && (item.system_id === incident.system_id || item.rule_id === incident.rule_id);
  }).length;

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

  return (
    <section className="space-y-5">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link
          href="/incidents"
          className="inline-flex items-center gap-1 hover:text-slate-900"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to Incident Queue
        </Link>
      </div>

      <Card className="p-0">
        <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="min-w-0">
            <p className="label-eyebrow">Incident</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
              {incident.title}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{incident.trigger_reason}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
              <span
                className={`rounded-full px-2 py-0.5 font-semibold ${severityBadgeClasses(incident.severity)}`}
              >
                {humanizeLabel(incident.severity)}
              </span>
              <span className={`rounded-full px-1.5 py-0.5 font-medium ${signalColor(signalType)}`}>
                {signalType}
              </span>
              <Badge tone="neutral" size="sm">
                {humanizeLabel(incident.risk_category)}
              </Badge>
              <Badge tone="outline" size="sm">
                {humanizeLabel(incident.incident_status)}
              </Badge>
              {incident.review_required ? (
                <Badge tone="medium" size="sm">
                  Review Required
                </Badge>
              ) : null}
              <span className="text-[11px] text-slate-500">
                · {formatRelativeTime(incident.created_at)}
              </span>
            </div>
          </div>
          <div className="shrink-0 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 shadow-sm md:max-w-sm">
            <p className="label-eyebrow text-amber-700">Recommended action</p>
            <p className="mt-1 font-medium leading-relaxed">{incident.recommended_action}</p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-px border-t border-slate-200 bg-slate-200 text-sm md:grid-cols-4">
          <MetaCell label="System">
            <Link
              href={`/systems/${incident.system_id}`}
              className="truncate font-medium text-slate-900 hover:underline"
            >
              {incident.system_name}
            </Link>
            <span className="block truncate text-[11px] text-slate-500">{incident.system_id}</span>
          </MetaCell>
          <MetaCell label="Owner Team">{incident.owner_team}</MetaCell>
          <MetaCell label="Control">
            <Link
              href={`/controls?q=${encodeURIComponent(incident.rule_id)}`}
              className="truncate font-mono text-[12px] text-slate-700 hover:text-slate-900 hover:underline"
            >
              {incident.rule_id}
            </Link>
          </MetaCell>
          <MetaCell label="Similar Incidents (7d)">
            <div className="flex items-center justify-between gap-2">
              <span>{formatInteger(similarLast7Days)}</span>
              {similarLast7Days > 0 ? (
                <Link
                  href={`/incidents?system=${incident.system_id}`}
                  className="text-[10px] font-medium text-slate-500 hover:text-slate-900 hover:underline"
                >
                  View →
                </Link>
              ) : null}
            </div>
          </MetaCell>
        </dl>
      </Card>

      <section>
        <header className="mb-2 flex items-center justify-between">
          <p className="label-eyebrow flex items-center gap-1.5 text-indigo-700">
            Bob Analysis
          </p>
          <p className="text-[11px] text-slate-500">
            Bob&apos;s read of likely root cause and recommended next action · separate
            from the human-driven incident record above.
          </p>
        </header>
        {investigation ? (
          <BobSummaryPanel investigation={investigation} variant="compact" />
        ) : (
          <BobEmptyPanel targetType="incident" targetId={incident.id} />
        )}
      </section>

      <Card>
        <CardHeader
          title="Evidence"
          caption={
            metricField
              ? `${metricLabel(metricField)} over recent telemetry events for ${incident.system_name}`
              : "Breach evidence and supporting metrics"
          }
          action={<GaugeCircle className="h-4 w-4 text-slate-400" />}
        />

        <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
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
              Dashed line shows the governance threshold. The latest value to the right of the chart is
              what caused this incident to fire.
            </p>
          </div>

          <div className="space-y-3">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="label-eyebrow">Supporting metrics</p>
              {supportingMetrics.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">
                  No additional telemetry captured in this window.
                </p>
              ) : (
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
                  {supportingMetrics.map((metric) => (
                    <div key={metric.key} className="min-w-0">
                      <dt className="truncate text-[11px] text-slate-500">{metric.label}</dt>
                      <dd className="tabular-nums text-sm font-semibold text-slate-900">
                        {formatMetric(metric.value, { digits: 2, unit: metric.unit ? ` ${metric.unit}` : "" })}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="label-eyebrow">Breach context</p>
              <p className="mt-2 text-sm text-slate-700">{incident.summary}</p>
              <p className="mt-2 text-[11px] text-slate-500">
                Event timestamp:{" "}
                {telemetry_context
                  ? formatRelativeTime(telemetry_context.timestamp)
                  : "—"}
              </p>
            </div>
          </div>
        </div>
      </Card>

      <IncidentWorkflowPanel
        incidentId={incident.id}
        initialIncidentStatus={incident.incident_status}
        initialEscalationStatus={incident.escalation_status}
        initialReviewRequired={incident.review_required}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Business & Governance Context"
            caption="What this incident means for the organization"
            action={<FileText className="h-4 w-4 text-slate-400" />}
          />
          <p className="mt-3 text-sm leading-relaxed text-slate-700">
            This incident affects governance confidence for a production AI workflow in{" "}
            <span className="font-medium text-slate-900">{incident.owner_team}</span>. If
            left untreated, it can increase policy exposure, review burden, and stakeholder
            risk in regulated decision flows.
          </p>
          <div className="mt-3 space-y-1.5 text-xs text-slate-600">
            <p>
              <span className="text-slate-400">Risk domain:</span>{" "}
              <span className="font-medium text-slate-800">
                {humanizeLabel(incident.risk_category)}
              </span>
            </p>
            <p>
              <span className="text-slate-400">Regulated workflow owner:</span>{" "}
              <span className="font-medium text-slate-800">{incident.owner_team}</span>
            </p>
            {investigation ? (
              <p className="pt-1 text-[11px] text-slate-500">
                For Bob&apos;s view of likely root cause and suggested fix, see the Bob
                Analysis section above.
              </p>
            ) : null}
          </div>
        </Card>
        <Card>
          <CardHeader title="Audit Trail" caption="Actions recorded for this incident" />
          <div className="mt-3">
            <ActivityFeed items={activityItems} emptyLabel="No audit entries yet." />
          </div>
        </Card>
      </div>
    </section>
  );
}

function MetaCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white px-5 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-0.5 truncate text-sm text-slate-800">{children}</div>
    </div>
  );
}
