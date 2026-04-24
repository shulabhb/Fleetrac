import { Suspense } from "react";
import { IncidentQueueTable } from "@/components/incident-queue-table";
import { SectionTitle } from "@/components/ui/section-title";
import { getIncidents } from "@/lib/api";

export default async function IncidentsPage() {
  const { items } = await getIncidents();

  return (
    <section className="space-y-5">
      <SectionTitle
        eyebrow="Observe · choose work"
        title="Incident Queue"
        caption="Main intake workbench. Choose an incident, understand the breach, then route to Bob investigation or a governed action."
      />
      <Suspense fallback={null}>
        <IncidentQueueTable incidents={items} />
      </Suspense>
    </section>
  );
}
