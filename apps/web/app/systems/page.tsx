import { SystemsFleetView } from "@/components/systems-fleet-view";
import { SectionTitle } from "@/components/ui/section-title";
import { getIncidents, getSystems } from "@/lib/api";
import { normalizeAiScope, systemMatchesScope } from "@/lib/ai-scope";

export default async function SystemsPage({
  searchParams
}: {
  searchParams?: Promise<{ scope?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const scope = normalizeAiScope(sp.scope);
  const [{ items }, incidentsRes] = await Promise.all([getSystems(), getIncidents()]);
  const systems = (items ?? []).filter((s: any) => systemMatchesScope(s, scope));
  const ids = new Set(systems.map((s: any) => s.id));
  const incidents = (incidentsRes.items ?? []).filter((i: any) => ids.has(i.system_id));

  return (
    <section className="space-y-5">
      <SectionTitle
        eyebrow="Production context"
        title="Systems"
        caption="Production truth and posture for monitored AI systems. Use this surface for context, then return to incident, action, or outcome work."
      />
      <SystemsFleetView systems={systems} incidents={incidents} />
    </section>
  );
}
