import Link from "next/link";
import { getIncidents, getSystems, getTelemetryEvents } from "@/lib/api";
import { humanizeLabel, postureBadgeClasses } from "@/lib/present";

function Sparkline({ points }: { points: number[] }) {
  if (points.length === 0) return null;
  const width = 220;
  const height = 60;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const spread = Math.max(max - min, 0.001);
  const path = points
    .map((value, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const y = height - ((value - min) / spread) * (height - 8) - 4;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-16 w-full">
      <polyline fill="none" stroke="#0f766e" strokeWidth="3" points={path} />
    </svg>
  );
}

export default async function DashboardPage() {
  const [systemsRes, incidentsRes, telemetryRes] = await Promise.all([
    getSystems(),
    getIncidents(),
    getTelemetryEvents("?limit=100")
  ]);

  const incidents = incidentsRes.items;
  const highSeverityIncidents = incidents
    .filter((item) => item.severity === "high")
    .slice(0, 6);
  const openIncidents = incidents.filter((item) => item.incident_status !== "closed").length;
  const pendingHumanReviews = incidents.filter(
    (item) => item.review_required && ["detected", "under_review"].includes(item.incident_status)
  ).length;
  const escalatedIncidents = incidents.filter(
    (item) => item.escalation_status === "escalated" || item.incident_status === "escalated"
  ).length;

  const latestBySystem = new Map<string, any>();
  for (const event of telemetryRes.items) {
    if (!latestBySystem.has(event.system_id)) {
      latestBySystem.set(event.system_id, event);
    }
  }
  const systemsBelowAuditThreshold = Array.from(latestBySystem.values()).filter(
    (event) => (event.audit_coverage_pct ?? 0) < 95
  ).length;
  const atRiskSystems = systemsRes.items
    .filter((system) => ["at_risk", "critical"].includes(system.risk_posture))
    .slice(0, 5);
  const urgentRanked = incidents
    .map((incident) => {
      const score =
        (incident.escalation_status === "escalated" ? 6 : 0) +
        (incident.incident_status === "escalated" ? 4 : 0) +
        (incident.severity === "high" ? 4 : incident.severity === "medium" ? 2 : 1) +
        (incident.review_required ? 2 : 0);
      return { incident, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const incidentsByRiskCategory = incidents.reduce((acc: Record<string, number>, incident) => {
    const key = incident.risk_category;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const incidentsByOwnerTeam = incidents.reduce((acc: Record<string, number>, incident) => {
    const key = incident.owner_team;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const driftSeries = Object.values(
    telemetryRes.items.reduce((acc: Record<string, number[]>, event: any) => {
      if (!acc[event.system_id]) acc[event.system_id] = [];
      if (event.drift_index != null && acc[event.system_id].length < 5) {
        acc[event.system_id].push(event.drift_index);
      }
      return acc;
    }, {})
  )
    .slice(0, 10)
    .flat()
    .slice(0, 20);

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Dashboard Overview</h2>
        <p className="mt-2 text-slate-600">
          Live mock snapshot generated from post-go-live monitoring data.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-slate-500">Open Incidents</p>
          <p className="mt-2 text-2xl font-semibold">{openIncidents}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-slate-500">High Severity Incidents</p>
          <p className="mt-2 text-2xl font-semibold">{highSeverityIncidents.length}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-slate-500">Pending Human Reviews</p>
          <p className="mt-2 text-2xl font-semibold">{pendingHumanReviews}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-slate-500">Escalated Incidents</p>
          <p className="mt-2 text-2xl font-semibold">{escalatedIncidents}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-slate-500">Systems Below Audit Threshold</p>
          <p className="mt-2 text-2xl font-semibold">{systemsBelowAuditThreshold}</p>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <p className="text-sm text-slate-500">Monitored Systems</p>
        <p className="mt-1 text-xl font-semibold">{systemsRes.items.length}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-700">Top At-Risk Systems</h3>
          <div className="mt-3 space-y-2">
            {atRiskSystems.length === 0 ? (
              <p className="text-sm text-slate-500">No systems currently marked at risk.</p>
            ) : (
              atRiskSystems.map((system) => (
                <div key={system.id} className="rounded border p-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{system.use_case}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${postureBadgeClasses(system.risk_posture)}`}
                    >
                      {humanizeLabel(system.risk_posture)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{system.id}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-700">Incidents by Risk Category</h3>
          <div className="mt-3 space-y-2">
            {Object.entries(incidentsByRiskCategory).map(([name, count]) => (
              <div key={name} className="flex items-center justify-between text-sm">
                <span>{humanizeLabel(name)}</span>
                <span className="font-semibold">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-700">Incidents by Owner Team</h3>
          <div className="mt-3 space-y-2">
            {Object.entries(incidentsByOwnerTeam)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([name, count]) => (
                <div key={name} className="flex items-center justify-between text-sm">
                  <span className="max-w-44 truncate" title={name}>
                    {name}
                  </span>
                  <span className="font-semibold">{count}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h3 className="text-lg font-semibold">Drift Trend Snapshot</h3>
        <p className="text-sm text-slate-600">
          Recent drift trend across monitored systems. The latest spike exceeded expected review thresholds.
        </p>
        <div className="mt-3">
          <Sparkline points={driftSeries} />
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h3 className="text-lg font-semibold">Needs Immediate Attention</h3>
        <p className="text-sm text-slate-600">
          Prioritized by escalation, repeated high-severity signals, open queue depth, and pending reviews.
        </p>
        <div className="mt-3 space-y-2">
          {urgentRanked.map(({ incident }) => (
            <Link
              key={incident.id}
              href={`/incidents/${incident.id}`}
              className="block rounded border p-3 hover:bg-slate-50"
            >
              <div className="flex items-center justify-between">
                <p className="font-medium">{incident.system_name}</p>
                <span className="text-xs text-rose-700">
                  {humanizeLabel(incident.severity)} · {humanizeLabel(incident.escalation_status)}
                </span>
              </div>
              <p className="text-sm text-slate-700">{incident.title}</p>
              <p className="text-xs text-slate-600">
                Owner: {incident.owner_team} · Next: {incident.recommended_action}
              </p>
            </Link>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h3 className="text-lg font-semibold">Recent High-Severity Incidents</h3>
        <div className="mt-4 space-y-3">
          {highSeverityIncidents.length === 0 ? (
            <p className="text-sm text-slate-500">No high-severity incidents right now.</p>
          ) : (
            highSeverityIncidents.map((incident) => (
              <Link
                key={incident.id}
                href={`/incidents/${incident.id}`}
                className="block rounded-md border p-3 hover:bg-slate-50"
              >
                <p className="font-medium">{incident.title}</p>
                <p className="text-sm text-slate-600">
                  {incident.system_name} · {humanizeLabel(incident.risk_category)} · {incident.owner_team} ·{" "}
                  {humanizeLabel(incident.incident_status)}
                </p>
              </Link>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
