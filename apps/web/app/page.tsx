import { GovernanceInsightsDashboard } from "@/components/dashboard/governance-insights-dashboard";
import { normalizeAiScope } from "@/lib/ai-scope";

export default async function DashboardPage({
  searchParams
}: {
  searchParams?: Promise<{ scope?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const scope = normalizeAiScope(sp.scope);

  return <GovernanceInsightsDashboard scope={scope} />;
}
