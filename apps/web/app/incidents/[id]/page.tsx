import { FileText } from "lucide-react";
import {
  getActions,
  getBobInvestigationForTarget,
  getIncidentDetail,
  getSystems,
  getTelemetryEvents
} from "@/lib/api";
import { BobSummaryPanel, BobEmptyPanel } from "@/components/bob/bob-summary-panel";
import { Card, CardHeader } from "@/components/ui/card";
import { DisclosureSection } from "@/components/shared/disclosure-section";
import { IncidentDetailEvidencePanel } from "@/components/incident-detail-evidence-panel";
import { IncidentDetailActivityFeed } from "@/components/incident-detail-activity-feed";
import { IncidentDetailHero } from "@/components/incident-detail-hero";
import { cn } from "@/lib/cn";
import { humanizeLabel, metricLabel, signalTypeForField, telemetryFieldForMetric } from "@/lib/present";
import {
  appendReturnTo,
  routes,
  routeToAction,
  routeToBobForTarget,
  routeToBobInvestigation,
  routeToSystem
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

function incidentSeverityDotClass(severity: string): string {
  if (severity === "high") return "bg-rose-500";
  if (severity === "medium") return "bg-amber-500";
  return "bg-emerald-500";
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
  const [detail, bobRes, actionsRes, systemsRes] = await Promise.all([
    getIncidentDetail(id),
    getBobInvestigationForTarget("incident", id).catch(() => ({ item: null })),
    getActions({ related_incident_id: id }).catch(() => ({ items: [] as any[] })),
    getSystems().catch(() => ({ items: [] as any[] }))
  ]);
  const investigation = bobRes?.item ?? null;
  const incidentActions = actionsRes?.items ?? [];
  const systems = systemsRes?.items ?? [];
  const { incident, telemetry_context, audit_entries } = detail;
  const scopedSystems = systems
    .slice()
    .sort((a: any, b: any) => String(a.name ?? "").localeCompare(String(b.name ?? "")));
  const systemIndex = scopedSystems.findIndex((s: any) => s.id === incident.system_id);
  const modelBadge = `M${systemIndex >= 0 ? systemIndex + 1 : 1}`;
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

  const firstAction = incidentActions[0] ?? null;
  const activityItems = (audit_entries ?? []).map((entry: any) => ({
    id: entry.id,
    action: entry.action,
    details: entry.details,
    timestamp: entry.timestamp,
    actor: entry.actor,
    targetId: entry.target_id
  }));

  const chartYDigits =
    metricField === "latency_p95_ms"
      ? 0
      : metricField === "audit_coverage_pct"
        ? 1
        : 3;

  const evidenceCaption =
    metricField
      ? `${metricLabel(metricField)} · ${incident.system_name}`
      : "Breach evidence and supporting metrics.";

  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "h-2 w-2 shrink-0 rounded-full ring-2 ring-white",
              incidentSeverityDotClass(incident.severity)
            )}
            aria-label={`Severity ${humanizeLabel(incident.severity)}`}
            title={`Severity · ${humanizeLabel(incident.severity)}`}
          />
          <h1 className="truncate text-[15px] font-semibold leading-snug text-slate-900 md:text-base">
            {incident.title}
          </h1>
        </div>
      </div>

      <IncidentDetailHero
        investigation={investigation}
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
        systemHref={appendReturnTo(routeToSystem(incident.system_id), here)}
        systemName={incident.system_name}
        modelBadge={modelBadge}
      />

      <div className="space-y-4">
        <IncidentDetailEvidencePanel
            incidentId={incident.id}
            incidentTitle={incident.title}
            summary={incident.summary}
            systemName={incident.system_name}
            triggerMetric={incident.trigger_metric}
            thresholdDisplay={incident.threshold}
            observedNumber={observedNumber}
            thresholdNumber={thresholdNumber}
            expectedValue={
              incident.expected_value != null && typeof incident.expected_value === "number"
                ? incident.expected_value
                : null
            }
            metricField={metricField}
            series={series}
            metricColor={metricColor(signalType)}
            yDigits={chartYDigits}
            supportingMetrics={supportingMetrics}
            telemetryTimestamp={telemetry_context?.timestamp ?? null}
            evidenceCaption={evidenceCaption}
          />

          <DisclosureSection
            defaultOpen
            eyebrow="Investigate · Act"
            title="Bob analysis"
            summary={
              investigation
                ? "Bob investigation available with root-cause support and recommendation context."
                : "No Bob investigation yet. Start analysis when operator triage is complete."
            }
          >
            {investigation ? (
              <BobSummaryPanel
                investigation={investigation}
                variant="compact"
                className="shadow-none border-slate-300 bg-slate-100/70 ring-1 ring-slate-400/10"
              />
            ) : (
              <BobEmptyPanel targetType="incident" targetId={incident.id} />
            )}
          </DisclosureSection>

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
