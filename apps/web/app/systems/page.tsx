import { SystemsFleetView } from "@/components/systems-fleet-view";
import { SectionTitle } from "@/components/ui/section-title";
import { getIncidents, getSystems } from "@/lib/api";

export default async function SystemsPage() {
  const [{ items }, incidentsRes] = await Promise.all([getSystems(), getIncidents()]);
  const incidents = incidentsRes.items;

  return (
    <section className="space-y-5">
      <SectionTitle
        eyebrow="Production context"
        title="Systems"
        caption="Production truth and posture for monitored AI systems. Use this surface for context, then return to incident, action, or outcome work."
      />
      <SystemsFleetView systems={items} incidents={incidents} />
    </section>
  );
}
