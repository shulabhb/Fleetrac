import { GovernancePageShell } from "@/components/layout/governance-page-shell";
import { SettingsView } from "@/components/operations/settings-view";
import {
  getConnectorStatus,
  getEnvironments,
  getExecutionConsole,
  getIntegrations,
  getOperationsPolicies
} from "@/lib/api";

export default async function SettingsPage() {
  const [
    { items: integrations },
    { items: policies },
    { items: environments },
    { items: connectors },
    { items: executionConsole }
  ] = await Promise.all([
    getIntegrations(),
    getOperationsPolicies(),
    getEnvironments(),
    getConnectorStatus(),
    getExecutionConsole({ limit: 60 })
  ]);

  const connected = integrations.filter((i: any) => i.status === "connected").length;

  return (
    <GovernancePageShell
      loop="configure"
      eyebrow="Configure · Control plane capability"
      title="Settings"
      subtitle={`${connected} connector records · ${policies.length} operations policies`}
      workflowLine="Prototype configuration only — connector status is not a live production integration."
    >
      <SettingsView
        integrations={integrations}
        policies={policies}
        environments={environments}
        connectors={connectors}
        executionConsole={executionConsole}
      />
    </GovernancePageShell>
  );
}
