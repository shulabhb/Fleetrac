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
      subtitle={`${connected} connectors connected · ${policies.length} operations policies`}
      workflowLine="Telemetry ingest, Slack notifications, policy scope, and connector readiness"
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
