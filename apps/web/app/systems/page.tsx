import { SystemsFleetView } from "@/components/systems-fleet-view";
import { SectionTitle } from "@/components/ui/section-title";
import { getIncidents, getSystems } from "@/lib/api";

export default async function SystemsPage() {
  const [{ items }, incidentsRes] = await Promise.all([getSystems(), getIncidents()]);
  const incidents = incidentsRes.items;

  return (
    <section className="space-y-5">
      <SectionTitle
        eyebrow="Fleet"
        title="Systems"
        caption="Every monitored AI system — with posture, ownership, and current governance load."
      />
      <SystemsFleetView systems={items} incidents={incidents} />
    </section>
  );
}
