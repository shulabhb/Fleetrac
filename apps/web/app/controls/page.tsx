import { ControlsBrowser } from "@/components/controls-browser";
import { SectionTitle } from "@/components/ui/section-title";
import { getBobInvestigations, getIncidents, getRules, getSystems } from "@/lib/api";
import { AI_SCOPE_OPTIONS, normalizeAiScope, systemMatchesScope } from "@/lib/ai-scope";

export default async function ControlsPage({
  searchParams
}: {
  searchParams?: Promise<{ scope?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const scope = normalizeAiScope(params.scope);
  const scopeLabel =
    AI_SCOPE_OPTIONS.find((opt) => opt.id === scope)?.label ?? "All";
  const [rulesRes, incidentsRes, bobRes, systemsRes] = await Promise.all([
    getRules(),
    getIncidents(),
    getBobInvestigations().catch(() => ({ items: [] as any[] })),
    getSystems().catch(() => ({ items: [] as any[] }))
  ]);
  const scopedSystemIds = new Set(
    (systemsRes.items ?? [])
      .filter((system: any) => systemMatchesScope(system, scope))
      .map((system: any) => system.id)
  );
  const scopedIncidents = (incidentsRes.items ?? []).filter((incident: any) =>
    scopedSystemIds.has(incident.system_id)
  );
  const scopedRuleIds = new Set(scopedIncidents.map((incident: any) => incident.rule_id));
  const scopedRules = (rulesRes.items ?? []).filter((rule: any) =>
    scopedRuleIds.has(rule.id)
  );
  const bobControlReviews = (bobRes.items ?? []).filter(
    (inv: any) => inv.target_type === "control"
  );
  const scopedBobControlReviews = bobControlReviews.filter((inv: any) =>
    scopedRuleIds.has(inv.target_id)
  );
  return (
    <section className="space-y-5">
      <SectionTitle
        eyebrow="Policy · Control operations"
        title="Governance Controls"
        caption={`Govern the health, calibration, and burden of controls themselves — not just downstream incidents. Open a control to review fleet impact, Bob signal, and tuning posture. Profile scope: ${scopeLabel}.`}
      />
      <ControlsBrowser
        rules={scopedRules}
        incidents={scopedIncidents}
        bobControlReviews={scopedBobControlReviews}
      />
    </section>
  );
}
