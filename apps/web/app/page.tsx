import Link from "next/link";
import {
  getActions,
  getAuditLogs,
  getBobImpactSummary,
  getBobInvestigations,
  getChanges,
  getIncidents,
  getSystems,
  getTelemetryEvents
} from "@/lib/api";
import { BobDashboardStrip } from "@/components/bob/bob-dashboard-strip";
import { ActionCenterStrip } from "@/components/actions/action-center-strip";
import { OutcomesStrip } from "@/components/operations/outcomes-strip";
import { OutcomeMiniRow } from "@/components/operations/outcomes-view";
import {
  AnalyticsStrip,
  type AnalyticsView
} from "@/components/charts/analytics-strip";
import { ActivityFeed } from "@/components/activity-feed";
import { AtRiskList } from "@/components/at-risk-list";
import { NeedsAttentionList } from "@/components/needs-attention-list";
import { BarList } from "@/components/charts/bar-list";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardHeader } from "@/components/ui/card";
import { SectionTitle } from "@/components/ui/section-title";
import { aggregateByDay, sumSeries } from "@/lib/analytics";
import { humanizeLabel, postureRank } from "@/lib/present";
import { formatInteger, formatMetric } from "@/lib/format";
import {
  routes,
  routeToBobForTarget,
  routeToControl,
  routeToIncident,
  routeToSystem
} from "@/lib/routes";

export default async function DashboardPage() {
  const [
    systemsRes,
    incidentsRes,
    telemetryRes,
    auditRes,
    bobRes,
    actionsRes,
    impactRes,
    changesRes
  ] = await Promise.all([
    getSystems(),
    getIncidents(),
    getTelemetryEvents("?limit=500"),
    getAuditLogs(),
    getBobInvestigations().catch(() => ({ items: [] as any[] })),
    getActions().catch(() => ({ items: [] as any[] })),
    getBobImpactSummary().catch(() => null),
    getChanges().catch(() => ({ items: [] as any[] }))
  ]);

  const allChanges = changesRes.items;
  const recentChanges = allChanges.slice(0, 6);

  const systems = systemsRes.items;
  const incidents = incidentsRes.items;
  const telemetry = telemetryRes.items;
  const auditLogs = auditRes.items;

  const openIncidents = incidents.filter((i) => i.incident_status !== "closed");
  const highSeverityIncidents = openIncidents.filter((i) => i.severity === "high");
  const pendingHumanReviews = incidents.filter(
    (i) => i.review_required && i.incident_status === "pending"
  );
  const escalatedIncidents = incidents.filter((i) => i.escalation_status === "escalated");
  const latestBySystem = new Map<string, any>();
  for (const event of telemetry) {
    if (!latestBySystem.has(event.system_id)) {
      latestBySystem.set(event.system_id, event);
    }
  }
  const systemsBelowAuditThreshold = Array.from(latestBySystem.values()).filter(
    (e) => (e.audit_coverage_pct ?? 100) < 95
  ).length;

  // ---- At-risk list (top 5 by posture + open incidents)
  const incidentsBySystem: Record<string, any[]> = {};
  for (const inc of incidents) {
    (incidentsBySystem[inc.system_id] ??= []).push(inc);
  }
  const atRiskSystems = [...systems]
    .filter((s) => ["at_risk", "critical", "watch"].includes(s.risk_posture))
    .map((system) => {
      const open = (incidentsBySystem[system.id] ?? []).filter(
        (i) => i.incident_status !== "closed"
      );
      const highestSeverity = ["high", "medium", "low"].find((sev) =>
        open.some((i) => i.severity === sev)
      ) as "high" | "medium" | "low" | undefined;
      return { system, openCount: open.length, highestSeverity };
    })
    .sort((a, b) => {
      const pr = postureRank(b.system.risk_posture) - postureRank(a.system.risk_posture);
      if (pr !== 0) return pr;
      return b.openCount - a.openCount;
    })
    .slice(0, 5);

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
      href: `/incidents?risk=${encodeURIComponent(label)}`
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  const ownerBars = Object.entries(byOwner)
    .map(([label, value]) => ({
      label,
      value,
      href: `/incidents?owner=${encodeURIComponent(label)}`
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // ---- Analytics strip time-series
  const driftTrend = aggregateByDay(telemetry, {
    valueFn: (e) => e.drift_index,
    reducer: "avg",
    days: 7
  });
  const incidentVolumeTrend = aggregateByDay(incidents, {
    valueFn: () => 1,
    reducer: "count",
    days: 7,
    timestampKey: "created_at"
  });
  const escalationTrend = aggregateByDay(incidents, {
    valueFn: () => 1,
    reducer: "count",
    filter: (i) => i.escalation_status === "escalated",
    days: 7,
    timestampKey: "created_at"
  });
  const reviewBacklogTrend = aggregateByDay(incidents, {
    valueFn: () => 1,
    reducer: "count",
    filter: (i) =>
      i.review_required && i.incident_status === "pending",
    days: 7,
    timestampKey: "created_at"
  });
  const auditBreachTrend = aggregateByDay(telemetry, {
    valueFn: (e) => e.audit_coverage_pct,
    reducer: "below_threshold_count",
    thresholdBelow: 95,
    days: 7
  });

  const analyticsViews: AnalyticsView[] = [
    {
      id: "drift",
      label: "Drift index",
      caption: "7-day fleet average.",
      info: "Distance from validated baseline. Above 0.25 typically correlates with reviewer-flagged regressions.",
      data: driftTrend,
      unit: "",
      threshold: 0.25,
      thresholdLabel: "Review threshold",
      color: "#0f172a",
      yDigits: 3,
      summary: `Peak ${formatMetric(
        Math.max(...driftTrend.map((p) => p.v ?? 0)),
        { digits: 3 }
      )}`
    },
    {
      id: "incidents",
      label: "Incident volume",
      caption: "Incidents detected per day.",
      info: "Every incident raised by the rule engine. Spikes indicate either an upstream regression or a noisy control.",
      data: incidentVolumeTrend,
      unit: "",
      color: "#be123c",
      yDigits: 0,
      summary: `${formatInteger(sumSeries(incidentVolumeTrend))} total · 7d`
    },
    {
      id: "escalations",
      label: "Escalations",
      caption: "Routed to leadership or specialists, per day.",
      info: "Trailing indicator of severity. A sustained climb means playbooks aren't resolving issues fast enough.",
      data: escalationTrend,
      unit: "",
      color: "#b45309",
      yDigits: 0,
      summary: `${formatInteger(sumSeries(escalationTrend))} total · 7d`
    },
    {
      id: "review",
      label: "Review backlog",
      caption: "Incidents awaiting human review, per day.",
      info: "Inflow into the reviewer queue. Pair with escalations to distinguish triage load from severity load.",
      data: reviewBacklogTrend,
      unit: "",
      color: "#0f766e",
      yDigits: 0,
      summary: `${formatInteger(sumSeries(reviewBacklogTrend))} total · 7d`
    },
    {
      id: "audit",
      label: "Audit coverage breaches",
      caption: "Events below the 95% floor, per day.",
      info: "Below 95% we cannot reconstruct a decision trail on a material share of events — a regulated-AI red flag.",
      data: auditBreachTrend,
      unit: "",
      color: "#0369a1",
      yDigits: 0,
      summary: `${formatInteger(sumSeries(auditBreachTrend))} events · 7d`
    }
  ];

  // ---- Activity feed
  // The audit log is the source of truth; the backend now emits a rich mix of
  // governance, control, Bob, and follow-up events with jittered timestamps.
  // We lightly de-dup so near-identical lines don't stack in the feed.
  const seenLabels = new Set<string>();
  const activityItems = auditLogs
    .map((entry: any) => ({
      id: entry.id,
      action: entry.action,
      details: entry.details,
      timestamp: entry.timestamp,
      targetId: entry.target_id,
      targetType: entry.target_type,
      actor: entry.actor
    }))
    .filter((item) => item.action !== "telemetry.processed")
    .filter((item) => {
      const key = `${item.action}::${item.targetId}::${(item.details ?? "").slice(0, 60)}`;
      if (seenLabels.has(key)) return false;
      seenLabels.add(key);
      return true;
    })
    .sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    .slice(0, 12);

  // ---- KPI captions (short, operational)
  const reviewTone: "neutral" | "warning" =
    pendingHumanReviews.length > 3 ? "warning" : "neutral";
  const auditTone: "ok" | "warning" =
    systemsBelowAuditThreshold > 0 ? "warning" : "ok";

  return (
    <section className="space-y-7">
      {/* ============ Overview ============ */}
      <SectionTitle
        eyebrow="Observe · orient"
        title="Governance Operations"
        caption={`${formatInteger(systems.length)} systems · ${formatInteger(openIncidents.length)} open incidents · Observe issues, investigate with Bob, govern actions, then measure outcomes.`}
        actions={
          <Link
            href={routes.incidents()}
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
          caption="Unresolved queue"
          tooltip="Incidents not yet mitigated, closed as false positive, or resolved."
          href={routes.incidents()}
        />
        <KpiCard
          label="High severity"
          value={formatInteger(highSeverityIncidents.length)}
          caption="Requires immediate ownership"
          tone="urgent"
          highlight={highSeverityIncidents.length > 0}
          tooltip="Open incidents classified as high severity by their triggering control."
          href={routes.incidents()}
        />
        <KpiCard
          label="Pending reviews"
          value={formatInteger(pendingHumanReviews.length)}
          caption="Awaiting reviewer decision"
          tone={reviewTone}
          highlight={pendingHumanReviews.length > 3}
          tooltip="Flagged for human review and not yet dispositioned."
          href={routes.incidents()}
        />
        <KpiCard
          label="Escalated"
          value={formatInteger(escalatedIncidents.length)}
          caption="Routed to leadership or specialists"
          tone={escalatedIncidents.length > 0 ? "urgent" : "neutral"}
          tooltip="Incidents promoted above standard review to a named escalation path."
          href={routes.incidents()}
        />
        <KpiCard
          label="Audit gaps"
          value={formatInteger(systemsBelowAuditThreshold)}
          caption="Systems below 95% coverage"
          tone={auditTone}
          tooltip="Systems whose latest telemetry event is under the 95% audit coverage floor."
          href={routes.systems()}
        />
      </div>

      {/* ============ Needs Immediate Attention + Top at-risk ============ */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-3 py-2.5 sm:px-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                Incidents
              </p>
            </div>
            <Link
              href={routes.incidents()}
              className="shrink-0 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
            >
              Full queue
            </Link>
          </div>
          <div className="max-h-[min(55vh,28rem)] overflow-y-auto overscroll-contain px-1 sm:px-2">
            <NeedsAttentionList incidents={incidents} />
          </div>
          <ActionCenterStrip embedded actions={actionsRes.items} />
        </div>
        <Card>
          <CardHeader
            title="Top at-risk systems"
            caption="Context for the queue. By posture and open incident pressure."
            action={
              <Link
                href={routes.systems()}
                className="text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                All systems →
              </Link>
            }
          />
          <div className="mt-1">
            <AtRiskList items={atRiskSystems} />
          </div>
        </Card>
      </div>

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

      {/* ============ Recent Changes & Impact ============ */}
      {recentChanges.length > 0 && (
        <Card>
          <CardHeader
            title="Recent changes & impact"
            caption="Latest measured outcomes after governed remediation."
            action={
              <Link
                href={routes.outcomes()}
                className="text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Measure all outcomes →
              </Link>
            }
          />
          <div className="mt-3 space-y-1.5">
            {recentChanges.map((c: any) => (
              <OutcomeMiniRow key={c.id} change={c} />
            ))}
          </div>
        </Card>
      )}

      {/* ============ Fleet analytics ============ */}
      <AnalyticsStrip views={analyticsViews} defaultViewId="drift" />

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

      {/* ============ Activity ============ */}
      <Card>
        <CardHeader
          title="Recent governance activity"
          caption="Audit-linked events across the operating loop."
        />
        <div className="mt-3">
          <ActivityFeed
            items={activityItems}
            hrefFor={(item) => {
              if (!item.targetId) return null;
              if (item.action?.startsWith("bob.") && item.targetType === "control") {
                return routeToBobForTarget("control", item.targetId);
              }
              if (item.action?.startsWith("bob.") && item.targetType === "incident") {
                return routeToBobForTarget("incident", item.targetId);
              }
              if (item.targetId.startsWith("inc_")) return routeToIncident(item.targetId);
              if (item.targetId.startsWith("sys_")) return routeToSystem(item.targetId);
              if (item.targetId.startsWith("rule_")) return routeToControl(item.targetId);
              return null;
            }}
          />
        </div>
      </Card>
    </section>
  );
}
