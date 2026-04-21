import { IncidentWorkflowPanel } from "@/components/incident-workflow-panel";
import { getIncidentDetail, getIncidents } from "@/lib/api";
import { humanizeLabel, severityBadgeClasses } from "@/lib/present";

type IncidentDetailPageProps = {
  params: {
    id: string;
  };
};

export default async function IncidentDetailPage({ params }: IncidentDetailPageProps) {
  const [detail, incidentsRes] = await Promise.all([getIncidentDetail(params.id), getIncidents()]);
  const { incident, telemetry_context, audit_entries } = detail;
  const similarLast7Days = incidentsRes.items.filter((item: any) => {
    if (item.id === incident.id) return false;
    const created = new Date(item.created_at).getTime();
    const ageMs = Date.now() - created;
    const within7Days = ageMs <= 7 * 24 * 60 * 60 * 1000;
    return within7Days && (item.system_id === incident.system_id || item.rule_id === incident.rule_id);
  }).length;

  return (
    <section className="space-y-5">
      <h2 className="text-2xl font-semibold">Incident Detail</h2>
      <div className="rounded-lg border bg-white p-4">
        <p className="text-lg font-semibold">{incident.title}</p>
        <p className="mt-2 text-slate-700">{incident.trigger_reason}</p>
        <div className="mt-3">
          <span
            className={`rounded px-2 py-1 text-xs font-semibold ${severityBadgeClasses(incident.severity)}`}
          >
            {humanizeLabel(incident.severity)} Severity
          </span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-600 md:grid-cols-2">
          <p>Rule: {incident.rule_id}</p>
          <p>Risk Category: {humanizeLabel(incident.risk_category)}</p>
          <p>Triggered Metric: {incident.trigger_metric}</p>
          <p>Threshold: {incident.threshold}</p>
          <p>Observed: {incident.observed_value}</p>
          <p>
            System: {incident.system_name}{" "}
            <span className="text-xs text-slate-500">({incident.system_id})</span>
          </p>
          <p>Lifecycle: {humanizeLabel(incident.incident_status)}</p>
          <p>Escalation: {humanizeLabel(incident.escalation_status)}</p>
          <p>Owner Team: {incident.owner_team}</p>
          <p>Human Review Required: {incident.review_required ? "Yes" : "No"}</p>
          <p>Similar Incidents (Last 7 Days): {similarLast7Days}</p>
        </div>
      </div>

      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
        <h3 className="font-semibold">Governance Recommendation</h3>
        <p className="mt-2 text-sm font-medium text-amber-900">{incident.recommended_action}</p>
      </div>

      <IncidentWorkflowPanel
        incidentId={incident.id}
        initialIncidentStatus={incident.incident_status}
        initialEscalationStatus={incident.escalation_status}
        initialReviewRequired={incident.review_required}
      />

      <div className="rounded-lg border bg-white p-4">
        <h3 className="font-semibold">Why This Matters</h3>
        <p className="mt-2 text-sm text-slate-700">
          This incident affects governance confidence for a production AI workflow. If left untreated,
          it can increase policy exposure, review burden, and stakeholder risk in regulated decision flows.
          The assigned owner team should validate controls and close the loop with an auditable mitigation decision.
        </p>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h3 className="font-semibold">Relevant Telemetry Context</h3>
        {telemetry_context ? (
          <div className="mt-3 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
            <p>Timestamp: {telemetry_context.timestamp}</p>
            <p>Latency p95: {telemetry_context.latency_p95_ms}</p>
            <p>Drift Index: {telemetry_context.drift_index}</p>
            <p>Grounding Score: {telemetry_context.grounding_score}</p>
            <p>Audit Coverage: {telemetry_context.audit_coverage_pct}</p>
            <p>Policy Violation Rate: {telemetry_context.policy_violation_rate}</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No telemetry context found.</p>
        )}
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h3 className="font-semibold">Audit Trail</h3>
        <div className="mt-3 space-y-2">
          {audit_entries.map((entry: any) => (
            <div key={entry.id} className="rounded border p-2 text-sm">
              <p className="font-medium">{entry.action}</p>
              <p className="text-slate-600">{entry.details}</p>
              <p className="text-xs text-slate-500">{entry.timestamp}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
