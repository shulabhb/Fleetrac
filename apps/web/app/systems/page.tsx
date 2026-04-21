import { getIncidents, getSystems } from "@/lib/api";
import { humanizeLabel, postureBadgeClasses, severityBadgeClasses } from "@/lib/present";

export default async function SystemsPage() {
  const [{ items }, incidentsRes] = await Promise.all([getSystems(), getIncidents()]);
  const incidents = incidentsRes.items;

  const incidentsBySystem = incidents.reduce(
    (acc: Record<string, any[]>, incident: any) => {
      if (!acc[incident.system_id]) acc[incident.system_id] = [];
      acc[incident.system_id].push(incident);
      return acc;
    },
    {}
  );

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">Systems</h2>
      <p className="text-slate-600">Monitored model inventory with current risk posture.</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {items.map((system: any) => (
          <article key={system.id} className="rounded-lg border bg-white p-4">
            {(() => {
              const systemIncidents = incidentsBySystem[system.id] ?? [];
              const openIncidents = systemIncidents.filter(
                (incident) => incident.incident_status !== "closed"
              );
              const highestSeverity =
                openIncidents.find((item) => item.severity === "high")?.severity ??
                openIncidents.find((item) => item.severity === "medium")?.severity ??
                openIncidents.find((item) => item.severity === "low")?.severity;
              const topIssue = openIncidents[0];
              const displayName = `${system.use_case} (${system.model})`;
              return (
                <>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{displayName}</h3>
                <p className="text-xs text-slate-500">{system.id}</p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${postureBadgeClasses(system.risk_posture)}`}
              >
                {humanizeLabel(system.risk_posture)}
              </span>
            </div>
            <div className="mt-3 space-y-1 text-sm text-slate-600">
              <p>Model: {system.model_type}</p>
              <p>Business Function: {system.business_function}</p>
              <p>Owner: {system.owner}</p>
              <p>Regulatory Sensitivity: {system.regulatory_sensitivity}</p>
              <p>Open Incidents: {openIncidents.length}</p>
              <p>
                Highest Severity:{" "}
                {highestSeverity ? (
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${severityBadgeClasses(highestSeverity)}`}>
                    {humanizeLabel(highestSeverity)}
                  </span>
                ) : (
                  "None"
                )}
              </p>
              <p className="truncate" title={topIssue?.title}>
                Top Active Issue: {topIssue ? topIssue.title : "No active governance issues"}
              </p>
            </div>
                </>
              );
            })()}
          </article>
        ))}
      </div>
    </section>
  );
}
