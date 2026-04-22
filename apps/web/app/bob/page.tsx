import { BobCopilotView } from "@/components/bob/bob-copilot-view";
import { SectionTitle } from "@/components/ui/section-title";
import { getBobInvestigations } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function BobCopilotPage() {
  const { items } = await getBobInvestigations();
  return (
    <section className="space-y-5">
      <SectionTitle
        eyebrow="Agentic Governance Copilot"
        title="Bob Copilot"
        caption="Queue of Bob&apos;s cross-entity investigations and recommendations awaiting human attention. This is where proposed fixes are reviewed, approved, rejected, or held for follow-up — distinct from the incident queue."
      />
      <BobCopilotView investigations={items} />
    </section>
  );
}
