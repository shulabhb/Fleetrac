import { ControlsBrowser } from "@/components/controls-browser";
import { SectionTitle } from "@/components/ui/section-title";
import { getBobInvestigations, getIncidents, getRules } from "@/lib/api";

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
        eyebrow="Policy · Control operations"
        title="Governance Controls"
        caption="Scope with buckets, then drill by signal or owner. Actions surface only when there is something to open."
      />
      <ControlsBrowser
        rules={rulesRes.items}
        incidents={incidentsRes.items}
        bobControlReviews={bobControlReviews}
      />
    </section>
  );
}
