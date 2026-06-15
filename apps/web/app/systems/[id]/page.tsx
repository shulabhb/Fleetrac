import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { GovernancePageShell } from "@/components/layout/governance-page-shell";
import { SystemGovernanceDetail } from "@/components/systems/system-governance-detail";
import { routes } from "@/lib/routes";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function SystemDetailPage({ params }: Props) {
  const { id } = await params;
  const systemId = decodeURIComponent(id);

  return (
    <GovernancePageShell
      loop="context"
      eyebrow="Context · System detail"
      title="System governance"
      subtitle={systemId}
      workflowLine="Telemetry and incidents inferred from simulator ingest pipeline"
      headerAction={
        <Link
          href={routes.systems()}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to registry
        </Link>
      }
    >
      <SystemGovernanceDetail systemId={systemId} />
    </GovernancePageShell>
  );
}
