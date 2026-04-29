import Link from "next/link";
import {
  getBobImpactSummary,
  getBobInvestigations,
  getChanges,
  getIncidents,
  getSystems
} from "@/lib/api";
import { BobDashboardStrip } from "@/components/bob/bob-dashboard-strip";
import { OutcomesStrip } from "@/components/operations/outcomes-strip";
import { BarList } from "@/components/charts/bar-list";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardHeader } from "@/components/ui/card";
import { SectionTitle } from "@/components/ui/section-title";
import { humanizeLabel } from "@/lib/present";
import { formatInteger } from "@/lib/format";
import { normalizeAiScope, systemMatchesScope, withAiScope } from "@/lib/ai-scope";
import { routes } from "@/lib/routes";
import { ModelRiskPivot } from "@/components/dashboard/model-risk-pivot";

export default async function DashboardPage({
  searchParams
}: {
  searchParams?: Promise<{ scope?: string }>;
}) {
  const ageBuckets = (items: any[]) => {
    const now = Date.now();
    return items.reduce(
      (acc, incident) => {
        const created = new Date(incident.created_at).getTime();
        const ageDays = Number.isFinite(created)
          ? Math.floor((now - created) / (1000 * 60 * 60 * 24))
          : 0;
        if (ageDays > 60) acc.gt60 += 1;
        else if (ageDays >= 30) acc.gte30 += 1;
        else acc.lt30 += 1;
        return acc;
      },
      { lt30: 0, gte30: 0, gt60: 0 }
    );
  };

  const agingLine = (buckets: { lt30: number; gte30: number; gt60: number }) => (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <span className="font-semibold text-emerald-700">
        &lt;30d {formatInteger(buckets.lt30)}
      </span>
      <span className="text-slate-300">·</span>
      <span className="font-semibold text-amber-700">
        30-60d {formatInteger(buckets.gte30)}
      </span>
      <span className="text-slate-300">·</span>
      <span className="font-semibold text-rose-700">
        &gt;60d {formatInteger(buckets.gt60)}
      </span>
    </span>
  );

  const sp = (await searchParams) ?? {};
  const scope = normalizeAiScope(sp.scope);
  const [
    systemsRes,
    incidentsRes,
    bobRes,
    impactRes,
    changesRes
  ] = await Promise.all([
    getSystems(),
    getIncidents(),
    getBobInvestigations().catch(() => ({ items: [] as any[] })),
    getBobImpactSummary().catch(() => null),
    getChanges().catch(() => ({ items: [] as any[] }))
  ]);

  const allChanges = changesRes.items;
  const outcomesMetrics = {
    monitoring: allChanges.filter(
      (c: any) => c.impact_status === "monitoring" || c.impact_status === "executed"
    ).length,
    improvement: allChanges.filter((c: any) => c.impact_status === "improvement_observed").length,
    followUp: allChanges.filter(
      (c: any) => c.impact_status === "follow_up_required" || c.follow_up_required
    ).length,
    rollback: allChanges.filter(
      (c: any) =>
        c.impact_status === "regression_detected" ||
        c.impact_status === "rollback_candidate" ||
        c.rollback_recommended
    ).length,
    closed: allChanges.filter(
      (c: any) => c.impact_status === "closed" || c.impact_status === "no_material_change"
    ).length
  };

  const allSystems = systemsRes.items;
  const matchingSystems = allSystems.filter((s) => systemMatchesScope(s, scope));
  const matchingIds = new Set(matchingSystems.map((s) => s.id));
  const systems = matchingSystems;
  const incidents = incidentsRes.items.filter((i) => matchingIds.has(i.system_id));

  const openIncidents = incidents.filter((i) => i.incident_status !== "closed");
  const highSeverityIncidents = openIncidents.filter((i) => i.severity === "high");
  const pendingHumanReviews = incidents.filter(
    (i) => i.review_required && i.incident_status === "pending"
  );
  const escalatedIncidents = incidents.filter((i) => i.escalation_status === "escalated");
  const resolvedIncidents = incidents.filter((i) => i.incident_status === "closed");
  const openAging = ageBuckets(openIncidents);
  const highAging = ageBuckets(highSeverityIncidents);
  const reviewAging = ageBuckets(pendingHumanReviews);
  const escalatedAging = ageBuckets(escalatedIncidents);
  const resolvedAging = ageBuckets(resolvedIncidents);

  // ---- Distributions
  const byRisk = incidents.reduce((acc: Record<string, number>, i) => {
    acc[i.risk_category] = (acc[i.risk_category] ?? 0) + 1;
    return acc;
  }, {});
  const byOwner = incidents.reduce((acc: Record<string, number>, i) => {
    acc[i.owner_team] = (acc[i.owner_team] ?? 0) + 1;
    return acc;
  }, {});
  const riskBars = Object.entries(byRisk)
    .map(([label, value]) => ({
      label: humanizeLabel(label),
      value,
      href: withAiScope(`/incidents?risk=${encodeURIComponent(label)}`, scope)
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  const ownerBars = Object.entries(byOwner)
    .map(([label, value]) => ({
      label,
      value,
      href: withAiScope(`/incidents?owner=${encodeURIComponent(label)}`, scope)
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // ---- KPI captions (short, operational)
  const reviewTone: "neutral" | "warning" =
    pendingHumanReviews.length > 3 ? "warning" : "neutral";

  return (
    <section className="space-y-7">
      {/* ============ Overview ============ */}
      <SectionTitle
        eyebrow="Observe · orient"
        title="Governance Insights"
        caption={`Total systems being governed: ${formatInteger(systems.length)} · Total open incidents: ${formatInteger(openIncidents.length)}`}
        actions={
          <Link
            href={withAiScope(routes.incidents(), scope)}
            className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900"
          >
            Choose incident work →
          </Link>
        }
      />

      {/* ============ KPI command row — Observe ============ */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Open incidents"
          value={formatInteger(openIncidents.length)}
          caption={agingLine(openAging)}
          tooltip="Incidents not yet mitigated, closed as false positive, or resolved."
          href={withAiScope(routes.incidents(), scope)}
        />
        <KpiCard
          label="High severity"
          value={formatInteger(highSeverityIncidents.length)}
          caption={agingLine(highAging)}
          tone="urgent"
          highlight={highSeverityIncidents.length > 0}
          tooltip="Open incidents classified as high severity by their triggering control."
          href={withAiScope(routes.incidents(), scope)}
        />
        <KpiCard
          label="Pending reviews"
          value={formatInteger(pendingHumanReviews.length)}
          caption={agingLine(reviewAging)}
          tone={reviewTone}
          highlight={pendingHumanReviews.length > 3}
          tooltip="Flagged for human review and not yet dispositioned."
          href={withAiScope(routes.incidents(), scope)}
        />
        <KpiCard
          label="Escalated"
          value={formatInteger(escalatedIncidents.length)}
          caption={agingLine(escalatedAging)}
          tone={escalatedIncidents.length > 0 ? "urgent" : "neutral"}
          tooltip="Incidents promoted above standard review to a named escalation path."
          href={withAiScope(routes.incidents(), scope)}
        />
        <KpiCard
          label="Resolved incidents"
          value={formatInteger(resolvedIncidents.length)}
          caption={agingLine(resolvedAging)}
          tone="ok"
          tooltip="Incidents closed as resolved or solved after remediation verification."
          href={withAiScope(routes.incidents(), scope)}
        />
      </div>

      {/* ============ Needs Immediate Attention + Top at-risk ============ */}
      <ModelRiskPivot systems={systems} incidents={incidents} changes={allChanges} scope={scope} />

      {/* ============ Investigate → Act → Measure band ============ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="label-eyebrow">Loop continuity</p>
          <p className="hidden text-[11px] text-slate-500 sm:block">
            Bob diagnoses → Outcomes verifies
          </p>
        </div>
        <BobDashboardStrip investigations={bobRes.items} />
        {allChanges.length > 0 ? (
          <OutcomesStrip changes={allChanges} bobImpact={impactRes?.item} />
        ) : null}
      </div>

      {/* ============ Change impact analysis ============ */}
      {allChanges.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="label-eyebrow">Recent changes & impact</p>
            <Link
              href={withAiScope(routes.outcomes(), scope)}
              className="text-[11px] font-medium text-slate-600 hover:text-slate-900"
            >
              Measure all outcomes →
            </Link>
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] md:grid-cols-5">
              <div>
                <p className="text-slate-500">Under monitoring</p>
                <p className="text-[15px] font-semibold tabular-nums text-slate-900">
                  {formatInteger(outcomesMetrics.monitoring)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Improvement observed</p>
                <p className="text-[15px] font-semibold tabular-nums text-emerald-700">
                  {formatInteger(outcomesMetrics.improvement)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Follow-up required</p>
                <p className="text-[15px] font-semibold tabular-nums text-amber-700">
                  {formatInteger(outcomesMetrics.followUp)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Rollback candidates</p>
                <p className="text-[15px] font-semibold tabular-nums text-rose-700">
                  {formatInteger(outcomesMetrics.rollback)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Closed / no material change</p>
                <p className="text-[15px] font-semibold tabular-nums text-slate-900">
                  {formatInteger(outcomesMetrics.closed)}
                </p>
              </div>
            </div>
            {impactRes?.item ? (
              <p className="mt-2 border-t border-slate-100 pt-2 text-[11px] text-slate-600">
                <span className="font-medium text-slate-700">{impactRes.item.window_label}</span>
                <span className="mx-1 text-slate-300">·</span>
                Recurrence reduced {formatInteger(impactRes.item.recurrence_reduced)}
                <span className="mx-1 text-slate-300">·</span>
                Reviewer burden reduced {formatInteger(impactRes.item.reviewer_burden_reduced)}
              </p>
            ) : null}
          </div>
        </div>
      )}

      {/* ============ Pressure distribution ============ */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Incidents by risk category"
            caption="Where control pressure is concentrated."
          />
          <div className="mt-3">
            <BarList items={riskBars} tone="accent" showPercent />
          </div>
        </Card>
        <Card>
          <CardHeader
            title="Incidents by owner team"
            caption="Governance load across ownership."
          />
          <div className="mt-3">
            <BarList items={ownerBars} tone="accent" showPercent />
          </div>
        </Card>
      </div>

      {/* Activity feed moved to dedicated Governance Activity view */}
    </section>
  );
}
