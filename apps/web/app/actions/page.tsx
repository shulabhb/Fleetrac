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
        caption="Decisions and execution for governed actions. Every item has an explicit approver, risk level, and execution boundary. Post-execution impact lives in Outcomes."
      />
      <ActionCenterView actions={items} changes={changesRes.items} />
    </section>
  );
}
