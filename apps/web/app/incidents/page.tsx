import { Suspense } from "react";
import { IncidentQueueTable } from "@/components/incident-queue-table";
import { SectionTitle } from "@/components/ui/section-title";
import { getIncidents, getSystems } from "@/lib/api";
import { normalizeAiScope, systemMatchesScope } from "@/lib/ai-scope";

export default async function IncidentsPage({
  searchParams
}: {
  searchParams?: Promise<{ scope?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const scope = normalizeAiScope(sp.scope);
  const [incRes, sysRes] = await Promise.all([getIncidents(), getSystems()]);
  const matchingIds = new Set(
    (sysRes.items ?? [])
      .filter((s: any) => systemMatchesScope(s, scope))
      .map((s: any) => s.id)
  );
  const items = (incRes.items ?? []).filter((i: any) => matchingIds.has(i.system_id));

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
