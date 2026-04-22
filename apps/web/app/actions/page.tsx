import { ActionCenterView } from "@/components/actions/action-center-view";
import { SectionTitle } from "@/components/ui/section-title";
import { getActions, getChanges } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function ActionCenterPage() {
  const [{ items }, changesRes] = await Promise.all([
    getActions(),
    getChanges().catch(() => ({ items: [] }))
  ]);
  return (
    <section className="space-y-5">
      <SectionTitle
        eyebrow="Governed Remediation"
        title="Action Center"
        caption="Operational surface for governed actions. Every item here has an explicit approver, risk level, execution boundary, and post-approval lifecycle. This is where Bob-prepared changes become approved, executed, and monitored."
      />
      <ActionCenterView actions={items} changes={changesRes.items} />
    </section>
  );
}
