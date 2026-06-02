import { SystemsFleetView } from "@/components/systems-fleet-view";
import { GovernancePageShell } from "@/components/layout/governance-page-shell";
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
  const openCount = incidents.filter((i: any) => i.incident_status !== "closed").length;

  return (
    <GovernancePageShell
      loop="context"
      eyebrow="Context · Fleet inventory"
      title="System Registry"
      subtitle={`${systems.length} systems · ${openCount} open incidents in scope`}
      workflowLine="Production truth for monitored AI systems — return to Incident Queue or Action Center for decisions"
    >
      <SystemsFleetView systems={systems} incidents={incidents} />
    </GovernancePageShell>
  );
}
