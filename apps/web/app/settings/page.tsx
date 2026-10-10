import { GovernancePageShell } from "@/components/layout/governance-page-shell";
import { SettingsInUse } from "@/components/operations/settings-in-use";
import { getIntegrations } from "@/lib/api";

export default async function SettingsPage() {
  const { items: integrations } = await getIntegrations().catch(() => ({ items: [] }));

  return (
    <GovernancePageShell
      loop="configure"
      eyebrow="Configure · Providers and controls"
      title="Settings"
      subtitle="Model providers and detection controls for the governed agents."
      workflowLine="These are the providers and controls in this workspace. A missing repository connection stays visible on Overview."
    >
      <SettingsInUse integrations={integrations} />
    </GovernancePageShell>
  );
}
