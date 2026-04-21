import { IncidentQueueTable } from "@/components/incident-queue-table";
import { getIncidents } from "@/lib/api";

export default async function IncidentsPage() {
  const { items } = await getIncidents();

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">Incident Queue</h2>
      <p className="text-slate-600">
        Governance incidents generated from active threshold breaches in monitored systems.
      </p>
      <IncidentQueueTable incidents={items} />
    </section>
  );
}
