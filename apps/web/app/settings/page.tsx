import { SectionTitle } from "@/components/ui/section-title";
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

  return (
    <section className="space-y-5">
      <SectionTitle
        eyebrow="Control plane capability"
        title="Settings"
        caption="Define what Fleetrac can observe, prepare, execute, and audit through integrations, policies, environments, and connector readiness."
      />
      <SettingsView
        integrations={integrations}
        policies={policies}
        environments={environments}
        connectors={connectors}
        executionConsole={executionConsole}
      />
    </section>
  );
}
