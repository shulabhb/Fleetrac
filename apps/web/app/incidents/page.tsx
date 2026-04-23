import { Suspense } from "react";
import { IncidentQueueTable } from "@/components/incident-queue-table";
import { SectionTitle } from "@/components/ui/section-title";
import { getIncidents } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function IncidentsPage() {
  const { items } = await getIncidents();

  return (
    <section className="space-y-5">
      <SectionTitle
        eyebrow="Triage"
        title="Incident Queue"
        caption="Every incident raised by a governance control."
      />
      <Suspense fallback={null}>
        <IncidentQueueTable incidents={items} />
      </Suspense>
    </section>
  );
}
