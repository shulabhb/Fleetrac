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
        caption="Firing rate, ownership, and Bob review state across the control fleet. Use buckets to scope: active, recurring, Bob-flagged, or quiet."
      />
      <ControlsBrowser
        rules={rulesRes.items}
        incidents={incidentsRes.items}
        bobControlReviews={bobControlReviews}
      />
    </section>
  );
}
