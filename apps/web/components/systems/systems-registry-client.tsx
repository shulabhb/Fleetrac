"use client";

import { useMemo } from "react";
import { SystemsFleetView } from "@/components/systems-fleet-view";
import { GovernancePageShell } from "@/components/layout/governance-page-shell";
import { useGovernanceData } from "@/hooks/use-governance-data";
import { normalizeAiScope } from "@/lib/ai-scope";
import {
  DEMO_AGENT_IDS,
  filterDemoAgents,
  sortDemoAgentsFirst
} from "@/lib/governed-fleet-registry";

export function SystemsRegistryClient({ scope }: { scope: string }) {
  const normalizedScope = normalizeAiScope(scope);
  const { governanceSystems, loading } = useGovernanceData();
  const systems = useMemo(
    () => sortDemoAgentsFirst(filterDemoAgents(governanceSystems?.items ?? [])),
    [governanceSystems]
  );
  const openCount = systems.reduce((sum, s) => sum + s.open_incidents, 0);

  return (
    <GovernancePageShell
      loop="context"
      eyebrow="Context · Governed agents"
      title="Agent Fleet"
      subtitle={
        loading
          ? "Loading fleet from governance API…"
          : `${systems.length} of ${DEMO_AGENT_IDS.length} focus agents · ${openCount} open risks`
      }
      workflowLine="Open an agent, then review its risk and decide the next step."
    >
      <SystemsFleetView systems={systems} />
    </GovernancePageShell>
  );
}
