import { ControlsBrowser } from "@/components/controls-browser";
import { SectionTitle } from "@/components/ui/section-title";
import { getBobInvestigations, getIncidents, getRules } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function ControlsPage() {
  const [rulesRes, incidentsRes, bobRes] = await Promise.all([
    getRules(),
    getIncidents(),
    getBobInvestigations().catch(() => ({ items: [] as any[] }))
  ]);
  const bobControlReviews = (bobRes.items ?? []).filter(
    (inv: any) => inv.target_type === "control"
  );
  return (
    <section className="space-y-5">
      <SectionTitle
        eyebrow="Policy"
        title="Governance Controls"
        caption="What controls exist, what they monitor, how often they fire, and who owns them. Bob&apos;s tuning suggestions appear alongside — clearly separated from the control catalog."
      />
      <ControlsBrowser
        rules={rulesRes.items}
        incidents={incidentsRes.items}
        bobControlReviews={bobControlReviews}
      />
    </section>
  );
}
