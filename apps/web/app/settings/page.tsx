import { SectionTitle } from "@/components/ui/section-title";
import { SettingsView } from "@/components/operations/settings-view";
import {
  getConnectorStatus,
  getEnvironments,
  getExecutionConsole,
  getIntegrations,
  getOperationsPolicies
} from "@/lib/api";

export const dynamic = "force-dynamic";

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
        eyebrow="Control Plane"
        title="Settings"
        caption="Integrations, governance defaults, environments, platform readiness and the operational acts Bob has prepared or executed. Fleetrac's operations control surface."
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
