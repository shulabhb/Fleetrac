import { Suspense } from "react";
import { IncidentQueueWorkspace } from "@/components/incidents/incident-queue-workspace";
import { SectionTitle } from "@/components/ui/section-title";
import { getIncidents, getSystems } from "@/lib/api";
import { normalizeAiScope, systemMatchesScope } from "@/lib/ai-scope";
import { DASHBOARD_KPI } from "@/lib/governance-dashboard-mock";

function decodeOwner(v: string | undefined): string | null {
  if (!v) return null;
  return decodeURIComponent(String(v).replace(/\+/g, " "));
}

export default async function IncidentsPage({
  searchParams
}: {
  searchParams?: Promise<{ scope?: string; owner?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const scope = normalizeAiScope(sp.scope);
  const ownerScoped = decodeOwner(sp.owner);
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
        eyebrow={ownerScoped ? "Filtered queue" : "All governance incidents"}
        title="Incident Queue"
        caption={
          ownerScoped
            ? `Showing incidents for owner team: ${ownerScoped}. Clear the owner filter in the table to see the full queue.`
            : `${DASHBOARD_KPI.activeIncidents} open · ${DASHBOARD_KPI.criticalDecisions} decisions waiting · ${DASHBOARD_KPI.ownersAboveTolerance} owners above risk tolerance`
        }
      />
      <Suspense fallback={null}>
        <IncidentQueueWorkspace incidents={items} />
      </Suspense>
    </section>
  );
}
