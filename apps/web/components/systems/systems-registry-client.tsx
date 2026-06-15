"use client";

import { SystemsFleetView } from "@/components/systems-fleet-view";
import { GovernancePageShell } from "@/components/layout/governance-page-shell";
import { useGovernanceData } from "@/hooks/use-governance-data";
import { normalizeAiScope } from "@/lib/ai-scope";

export function SystemsRegistryClient({ scope }: { scope: string }) {
  const normalizedScope = normalizeAiScope(scope);
  const { governanceSystems, loading } = useGovernanceData();
  const systems = governanceSystems?.items ?? [];
  const openCount = systems.reduce((sum, s) => sum + s.open_incidents, 0);

  return (
    <GovernancePageShell
      loop="context"
      eyebrow="Context · Fleet inventory"
      title="System Registry"
      subtitle={
        loading
          ? "Loading fleet from governance API…"
          : `${systems.length} systems · ${openCount} open incidents`
      }
      workflowLine="Production truth from ingested telemetry — return to Live Signals or Incident Queue"
    >
      <SystemsFleetView systems={systems} />
    </GovernancePageShell>
  );
}
