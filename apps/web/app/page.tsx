import Link from "next/link";
import {
  getAuditLogs,
  getBobInvestigations,
  getIncidents,
  getSystems,
  getTelemetryEvents
} from "@/lib/api";
import { BobIcon } from "@/components/bob/bob-icon";
import { ArrowRight } from "lucide-react";
import { AnalyticsStrip, type AnalyticsView } from "@/components/charts/analytics-strip";
import { ActivityFeed } from "@/components/activity-feed";
import { AtRiskList } from "@/components/at-risk-list";
import { NeedsAttentionList } from "@/components/needs-attention-list";
import { BarList } from "@/components/charts/bar-list";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardHeader } from "@/components/ui/card";
import { SectionTitle } from "@/components/ui/section-title";
import { aggregateByDay, sumSeries } from "@/lib/analytics";
import { humanizeLabel, postureRank, severityRank } from "@/lib/present";
import { formatInteger, formatMetric } from "@/lib/format";

export default async function DashboardPage() {
  const [systemsRes, incidentsRes, telemetryRes, auditRes, bobRes] = await Promise.all([
    getSystems(),
    getIncidents(),
    getTelemetryEvents("?limit=500"),
    getAuditLogs(),
    getBobInvestigations().catch(() => ({ items: [] as any[] }))
  ]);

  const systems = systemsRes.items;
  const incidents = incidentsRes.items;
  const telemetry = telemetryRes.items;
  const auditLogs = auditRes.items;

  const openIncidents = incidents.filter((i) => i.incident_status !== "closed");
  const highSeverityIncidents = openIncidents.filter((i) => i.severity === "high");
  const pendingHumanReviews = incidents.filter(
    (i) => i.review_required && ["detected", "under_review"].includes(i.incident_status)
  );
  const escalatedIncidents = incidents.filter(
    (i) => i.escalation_status === "escalated" || i.incident_status === "escalated"
  );
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
      const open = (incidentsBySystem[system.id] ?? []).filter((i) => i.incident_status !== "closed");
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

  // ---- Urgent queue
  const urgentRanked = incidents
    .map((incident) => {
      const score =
        (incident.escalation_status === "escalated" ? 8 : 0) +
        (incident.incident_status === "escalated" ? 5 : 0) +
        severityRank(incident.severity) * 3 +
        (incident.review_required ? 2 : 0) +
        (incident.incident_status === "closed" ? -10 : 0);
      return { incident, score };
    })
    .filter((i) => i.incident.incident_status !== "closed")
    .sort((a, b) => b.score - a.score)
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
    filter: (i) => i.escalation_status === "escalated" || i.incident_status === "escalated",
    days: 7,
    timestampKey: "created_at"
  });
  const reviewBacklogTrend = aggregateByDay(incidents, {
    valueFn: () => 1,
    reducer: "count",
    filter: (i) =>
      i.review_required && ["detected", "under_review"].includes(i.incident_status),
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
      label: "Fleet Drift Trend",
      caption: "Last 7 days · average drift index across monitored systems",
      info: "Drift index captures how far model behavior has moved from its validated baseline. Values above 0.25 historically correlate with reviewer-flagged regressions.",
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
      label: "Incident Volume",
      caption: "Incidents detected per day, across all governance controls",
      info: "Counts every incident created by the rule engine. Spikes usually indicate either a real upstream regression or a noisy control that may need retuning.",
      data: incidentVolumeTrend,
      unit: "",
      color: "#be123c",
      yDigits: 0,
      summary: `${formatInteger(sumSeries(incidentVolumeTrend))} total`
    },
    {
      id: "escalations",
      label: "Escalations Over Time",
      caption: "Incidents promoted to leadership or specialist review per day",
      info: "Escalations are a trailing indicator of governance severity. A sustained climb typically means existing playbooks are not resolving issues fast enough.",
      data: escalationTrend,
      unit: "",
      color: "#b45309",
      yDigits: 0,
      summary: `${formatInteger(sumSeries(escalationTrend))} total`
    },
    {
      id: "review",
      label: "Review Backlog",
      caption: "New incidents requiring human review, per day",
      info: "Tracks inflow into the human-in-the-loop queue. Use alongside Escalations to distinguish triage load from severity load.",
      data: reviewBacklogTrend,
      unit: "",
      color: "#0f766e",
      yDigits: 0,
      summary: `${formatInteger(sumSeries(reviewBacklogTrend))} total`
    },
    {
      id: "audit",
      label: "Audit Threshold Breaches",
      caption: "Events falling below the 95% audit coverage minimum, per day",
      info: "Audit coverage below 95% means we cannot reconstruct a decision trail on a material share of events — a regulated-AI red flag.",
      data: auditBreachTrend,
      unit: "",
      color: "#0369a1",
      yDigits: 0,
      summary: `${formatInteger(sumSeries(auditBreachTrend))} events`
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
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 12);

  return (
    <section className="space-y-6">
      <SectionTitle
        eyebrow="Overview"
        title="Governance Operations"
        caption={`${formatInteger(systems.length)} systems monitored · ${formatInteger(openIncidents.length)} open incidents · mock telemetry feed`}
        actions={
          <Link
            href="/incidents"
            className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900"
          >
            Open Incident Queue →
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Open Incidents"
          value={formatInteger(openIncidents.length)}
          caption="Unresolved governance queue"
          tooltip="Incidents that have not yet been mitigated, false-positive-closed, or explicitly resolved."
        />
        <KpiCard
          label="High Severity"
          value={formatInteger(highSeverityIncidents.length)}
          caption="Requires immediate ownership"
          tone="urgent"
          highlight={highSeverityIncidents.length > 0}
          tooltip="Open incidents classified as high severity by their triggering governance control."
        />
        <KpiCard
          label="Pending Reviews"
          value={formatInteger(pendingHumanReviews.length)}
          caption="Awaiting reviewer decision"
          tone={pendingHumanReviews.length > 3 ? "warning" : "neutral"}
          highlight={pendingHumanReviews.length > 3}
          tooltip="Incidents flagged for human-in-the-loop review that have not been dispositioned."
        />
        <KpiCard
          label="Escalated"
          value={formatInteger(escalatedIncidents.length)}
          caption="Routed to leadership or specialists"
          tone={escalatedIncidents.length > 0 ? "urgent" : "neutral"}
          tooltip="Incidents promoted above standard review to a named escalation path."
        />
        <KpiCard
          label="Audit Gaps"
          value={formatInteger(systemsBelowAuditThreshold)}
          caption="Systems below 95% coverage minimum"
          tone={systemsBelowAuditThreshold > 0 ? "warning" : "ok"}
          tooltip="Count of systems whose latest telemetry event shows audit coverage under the regulated 95% floor."
        />
      </div>

      <BobDashboardStrip investigations={bobRes.items} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <AnalyticsStrip views={analyticsViews} defaultViewId="drift" />
        <Card>
          <CardHeader
            title="Top At-Risk Systems"
            caption="Ordered by posture and open incident pressure"
          />
          <div className="mt-2">
            <AtRiskList items={atRiskSystems} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Incidents by Risk Category"
            caption="Breakdown of the full incident population"
          />
          <div className="mt-3">
            <BarList items={riskBars} tone="accent" />
          </div>
        </Card>
        <Card>
          <CardHeader
            title="Incidents by Owner Team"
            caption="Where the governance load is concentrated"
          />
          <div className="mt-3">
            <BarList items={ownerBars} tone="accent" />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Needs Immediate Attention"
          caption="Ranked by escalation, severity, and review urgency"
          action={
            <Link
              href="/incidents"
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              View all →
            </Link>
          }
        />
        <div className="mt-1">
          <NeedsAttentionList rows={urgentRanked} />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Recent Governance Activity"
          caption="Incidents, controls, reviews, and audit events across the fleet"
        />
        <div className="mt-3">
          <ActivityFeed
            items={activityItems}
            hrefFor={(item) => {
              if (!item.targetId) return null;
              // Bob events that target a control should deep-link to Bob
              if (item.action?.startsWith("bob.") && item.targetType === "control") {
                return `/bob/for/control/${item.targetId}`;
              }
              if (item.action?.startsWith("bob.") && item.targetType === "incident") {
                return `/bob/for/incident/${item.targetId}`;
              }
              if (item.targetId.startsWith("inc_")) return `/incidents/${item.targetId}`;
              if (item.targetId.startsWith("sys_")) return `/systems/${item.targetId}`;
              if (item.targetId.startsWith("rule_")) return `/controls`;
              return null;
            }}
          />
        </div>
      </Card>
    </section>
  );
}

function BobDashboardStrip({ investigations }: { investigations: any[] }) {
  const open = investigations.filter((i) =>
    ["draft", "ready_for_review", "awaiting_approval"].includes(i.status)
  );
  const awaiting = investigations.filter((i) => i.status === "awaiting_approval");
  const recurring = investigations.filter((i) => i.recurring_issue_flag);
  const pendingRecs = investigations.reduce(
    (acc: number, inv: any) =>
      acc + (inv.recommendations || []).filter((r: any) => r.approval_status === "pending").length,
    0
  );

  return (
    <div className="relative flex flex-wrap items-center gap-4 rounded-lg border border-indigo-100 bg-white px-4 py-3">
      <span
        aria-hidden
        className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r bg-gradient-to-b from-indigo-400 to-indigo-200"
      />
      <div className="flex items-center gap-2 pl-2">
        <BobIcon size="sm" />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
            Bob Copilot · Governance AI layer
          </p>
          <p className="text-xs text-slate-600">
            Mock investigations generated from live incident, system and control state.
          </p>
        </div>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-4 text-xs">
        <StripStat label="Open investigations" value={open.length} />
        <StripStat label="Awaiting approval" value={awaiting.length} emphasize={awaiting.length > 0} />
        <StripStat label="Pending recommendations" value={pendingRecs} />
        <StripStat label="Recurring patterns" value={recurring.length} />
        <Link
          href="/bob"
          className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-medium text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-50"
        >
          Open Bob Copilot
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

function StripStat({
  label,
  value,
  emphasize
}: {
  label: string;
  value: number;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span
        className={
          "text-sm font-semibold tabular-nums " +
          (emphasize ? "text-amber-700" : "text-slate-900")
        }
      >
        {formatInteger(value)}
      </span>
      <span className="text-[11px] text-slate-500">{label}</span>
    </div>
  );
}
