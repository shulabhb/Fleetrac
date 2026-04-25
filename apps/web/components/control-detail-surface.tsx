"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { Sparkline } from "@/components/charts/sparkline";
import { BobIcon } from "@/components/bob/bob-icon";
import { AnalyzeWithBob } from "@/components/bob/analyze-with-bob";
import { DisclosureSection } from "@/components/shared/disclosure-section";
import { FlowBreadcrumb } from "@/components/shared/flow-breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardSection } from "@/components/ui/card";
import type { ControlOperationalSnapshot } from "@/lib/control-operational-context";
import { formatInteger, formatRelativeTime } from "@/lib/format";
import { humanizeLabel, severityBadgeClasses } from "@/lib/present";
import { verdictColor, verdictRing } from "@/lib/governance-states";
import {
  appendReturnTo,
  routeToAction,
  routeToBobForTarget,
  routeToBobInvestigation,
  routeToIncident,
  routeToIncidentsForControl,
  routeToSystem,
  routes
} from "@/lib/routes";

type Props = {
  rule: any;
  snapshot: ControlOperationalSnapshot;
  bobInvestigation: any | null;
  relatedActions: any[];
  returnTo: string;
  here: string;
};

const DEMO_ACTIONS = [
  "Open Bob control review",
  "Prepare control tuning",
  "View affected incidents",
  "Split control",
  "Tune threshold",
  "Change routing"
] as const;

function toneToVerdictKey(
  t: ControlOperationalSnapshot["verdictTone"]
): keyof typeof verdictRing {
  switch (t) {
    case "urgent":
      return "urgent";
    case "warn":
      return "warn";
    case "ok":
      return "ok";
    case "info":
      return "info";
    default:
      return "neutral";
  }
}

export function ControlDetailSurface({
  rule,
  snapshot,
  bobInvestigation,
  relatedActions,
  returnTo,
  here
}: Props) {
  const healthRef = useRef<HTMLDivElement>(null);
  const [demoAck, setDemoAck] = useState<string | null>(null);

  const latestOpen = useMemo(
    () => snapshot.openIncidentsList[0] ?? snapshot.latestIncidents[0] ?? null,
    [snapshot.openIncidentsList, snapshot.latestIncidents]
  );
  const firstAction = relatedActions[0] ?? null;

  const topRec = useMemo(() => {
    if (!bobInvestigation?.recommendations?.length) return null;
    const id = bobInvestigation.top_recommendation_id;
    return (
      bobInvestigation.recommendations.find((r: any) => r.id === id) ??
      bobInvestigation.recommendations[0]
    );
  }, [bobInvestigation]);

  const sparkPoints = useMemo(() => {
    const pts = snapshot.firesByDay14.length
      ? snapshot.firesByDay14
      : snapshot.firesByDay7;
    if (pts.reduce((a, b) => a + b, 0) === 0) return [0, 0];
    return pts;
  }, [snapshot.firesByDay14, snapshot.firesByDay7]);

  const scrollHealth = useCallback(() => {
    healthRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const runDemo = useCallback((label: string) => {
    setDemoAck(`${label} — recorded locally for demo (no backend mutation).`);
  }, []);

  const ring = verdictRing[toneToVerdictKey(snapshot.verdictTone)];
  const color = verdictColor[toneToVerdictKey(snapshot.verdictTone)];

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={returnTo}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-800"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to Governance Controls
        </Link>
      </div>

      <FlowBreadcrumb
        steps={[
          { label: "Governance control", icon: "control", active: true },
          latestOpen
            ? {
                label: "Incident",
                href: appendReturnTo(routeToIncident(latestOpen.id), here),
                icon: "incident"
              }
            : { label: "Incident", icon: "incident", missing: true },
          bobInvestigation
            ? {
                label: "Bob review",
                href: appendReturnTo(
                  routeToBobInvestigation(bobInvestigation.id),
                  here
                ),
                icon: "bob"
              }
            : { label: "Bob review", icon: "bob", missing: true },
          firstAction
            ? {
                label: "Governed action",
                href: appendReturnTo(routeToAction(firstAction.id), here),
                icon: "action"
              }
            : { label: "Governed action", icon: "action", missing: true }
        ]}
      />

      {/* Hero */}
      <Card surface="decision" className="border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="label-eyebrow text-indigo-900/80">
              Policy · Control operations
            </p>
            <h1 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">
              {snapshot.ruleName}
            </h1>
            <p className="mt-1 font-mono text-[11px] text-slate-500">{snapshot.ruleId}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {snapshot.bobFlagged ? (
                <Badge tone="info" size="xs" className="gap-0.5 font-semibold">
                  <BobIcon size="xs" withBackground={false} />
                  Bob flagged
                </Badge>
              ) : null}
              {snapshot.activeNow ? (
                <Badge tone="high" size="xs">
                  Active now
                </Badge>
              ) : (
                <Badge tone="neutral" size="xs">
                  Quiet (7d)
                </Badge>
              )}
              {snapshot.recurring7d ? (
                <Badge tone="medium" size="xs">
                  Recurring
                </Badge>
              ) : null}
              {snapshot.verdictChips.includes("Needs tuning") ||
              snapshot.verdictChips.some((c) => c.toLowerCase().includes("tuning")) ? (
                <Badge tone="medium" size="xs">
                  Needs tuning
                </Badge>
              ) : null}
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${severityBadgeClasses(snapshot.severity)}`}
              >
                {humanizeLabel(snapshot.severity)} severity
              </span>
            </div>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-x-4 gap-y-1 text-right text-[11px] text-slate-600 sm:text-left">
            <Stat k="Signal" v={snapshot.signal} />
            <Stat k="Risk domain" v={snapshot.risk} />
            <Stat k="Owner team" v={snapshot.ownerTeam} />
            <Stat
              k="Last triggered"
              v={
                snapshot.lastTriggeredAt
                  ? formatRelativeTime(snapshot.lastTriggeredAt)
                  : "—"
              }
            />
            <Stat k="Systems (7d)" v={formatInteger(snapshot.systemsCovered7d)} />
            <Stat k="Incidents (7d)" v={formatInteger(snapshot.incidents7d)} />
            <Stat k="Total fires" v={formatInteger(snapshot.totalFires)} />
            <Stat k="Open incidents" v={formatInteger(snapshot.openIncidents)} />
          </div>
        </div>
        <p className="mt-3 border-t border-indigo-100/80 pt-3 text-sm leading-relaxed text-slate-700">
          <span className="font-medium text-slate-800">Recommended: </span>
          {snapshot.recommendedSummary}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-indigo-100/60 pt-3">
          <button
            type="button"
            onClick={scrollHealth}
            className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
          >
            Review control health
          </button>
          {snapshot.openIncidents > 0 || snapshot.incidents7d > 0 ? (
            <Link
              href={appendReturnTo(
                routeToIncidentsForControl(snapshot.ruleId),
                here
              )}
              className="inline-flex items-center gap-0.5 text-xs font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
            >
              Open related incidents
              {snapshot.openIncidents > 0
                ? ` (${formatInteger(snapshot.openIncidents)} open)`
                : ""}
              <ChevronRight className="h-3 w-3 opacity-60" />
            </Link>
          ) : null}
          {bobInvestigation ? (
            <Link
              href={appendReturnTo(
                routeToBobInvestigation(bobInvestigation.id),
                here
              )}
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-800 hover:text-indigo-950"
            >
              <BobIcon size="xs" withBackground={false} />
              Open Bob control review
              <ExternalLink className="h-3 w-3 opacity-50" />
            </Link>
          ) : (
            <Link
              href={appendReturnTo(
                routeToBobForTarget("control", snapshot.ruleId),
                here
              )}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              <BobIcon size="xs" withBackground={false} />
              Start Bob review (resolver)
            </Link>
          )}
        </div>
      </Card>

      {/* Control health verdict */}
      <div id="control-health" ref={healthRef} className="scroll-mt-4">
        <Card>
          <CardHeader
            title="Control health verdict"
            caption="Fleet-wide calibration, burden, and routing — not a single incident verdict."
          />
          <CardSection>
            <p
              className={`rounded-md px-3 py-2 text-sm leading-relaxed ring-1 ring-inset ${ring}`}
            >
              {snapshot.verdictSentence}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {snapshot.verdictChips.map((c) => (
                <span
                  key={c}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-700"
                >
                  {c}
                </span>
              ))}
            </div>
            <p className={`mt-2 text-xs font-medium ${color}`}>
              Escalation rate (7d):{" "}
              {snapshot.incidents7d > 0
                ? `${Math.round(snapshot.escalationRate7d * 100)}% · Reviewer-touched fires: ${formatInteger(snapshot.reviewBurden7d)}`
                : "No fires in window"}
            </p>
          </CardSection>
        </Card>
      </div>

      {/* Recommended next actions (demo) */}
      <Card surface="support">
        <CardHeader
          title="Recommended next action"
          caption="Bob remains bounded, approval-gated, policy-checked, audit-linked, and reversible-by-default where supported."
        />
        <CardSection>
          <div className="flex flex-wrap gap-2">
            {DEMO_ACTIONS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => runDemo(a)}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                {a}
              </button>
            ))}
          </div>
          {demoAck ? (
            <p className="mt-2 text-[11px] text-slate-500" role="status">
              {demoAck}
            </p>
          ) : null}
        </CardSection>
      </Card>

      {/* Fire trend */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Fire trend and projection"
            caption="Observed incident counts from this control — illustrative projection only."
          />
          <CardSection>
            <div className="grid gap-3 sm:grid-cols-4">
              <MiniStat label="Fires (7d)" value={formatInteger(snapshot.incidents7d)} />
              <MiniStat label="Fires (30d)" value={formatInteger(snapshot.incidents30d)} />
              <MiniStat
                label="Systems (7d)"
                value={formatInteger(snapshot.systemsCovered7d)}
              />
              <MiniStat
                label="Review burden"
                value={`${formatInteger(snapshot.reviewBurden7d)} touched`}
              />
            </div>
            <div className="mt-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Daily fires (rolling)
              </p>
              <div className="mt-1 h-[52px] w-full">
                <Sparkline
                  points={sparkPoints}
                  tone={snapshot.incidents7d >= 4 ? "danger" : "accent"}
                  height={52}
                />
              </div>
              <p className="mt-2 text-xs text-slate-600">
                Projected next 7d:{" "}
                <span className="font-semibold tabular-nums text-slate-900">
                  {formatInteger(snapshot.projectionLow)}–
                  {formatInteger(snapshot.projectionHigh)}
                </span>{" "}
                fires if no tuning is applied (heuristic from recent rate).
              </p>
            </div>
          </CardSection>
        </Card>
        <Card>
          <CardHeader title="Routing load" caption="Qualitative burden signal." />
          <CardSection className="space-y-2 text-xs text-slate-600">
            <p>
              Prepared actions linked to this control:{" "}
              <span className="font-semibold text-slate-900">
                {formatInteger(relatedActions.length)}
              </span>
            </p>
            <p>
              Bob is bounded and approval-gated; tuning or split requests should
              route through Action Center when policy requires it.
            </p>
          </CardSection>
        </Card>
      </div>

      {/* Fleet impact */}
      <Card>
        <CardHeader
          title="Fleet impact"
          caption="Systems most touched by this control in the last 7 days."
        />
        <CardSection>
          {snapshot.fleetSystems.length === 0 ? (
            <p className="text-sm text-slate-500">
              No fires in the 7-day window — no ranked system load.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {snapshot.fleetSystems.slice(0, 8).map((row) => (
                <li
                  key={row.systemId}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <Link
                    href={appendReturnTo(routeToSystem(row.systemId), here)}
                    className="font-medium text-slate-800 hover:underline"
                  >
                    {row.systemName}
                  </Link>
                  <span className="tabular-nums text-[11px] text-slate-600">
                    {formatInteger(row.fires7d)} fires (7d)
                    {row.escalated > 0
                      ? ` · ${formatInteger(row.escalated)} escalated`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-slate-500">
            Owner distribution follows incident payloads; primary owner for this
            control:{" "}
            <span className="font-medium text-slate-700">{snapshot.ownerTeam}</span>
          </p>
        </CardSection>
      </Card>

      {/* Related incidents */}
      <Card>
        <CardHeader
          title="Related incidents"
          caption="Supporting context — incidents are signals, not the governed object here."
          action={
            <Link
              href={appendReturnTo(
                routeToIncidentsForControl(snapshot.ruleId),
                here
              )}
              className="text-xs font-medium text-slate-700 hover:text-slate-900"
            >
              Open incidents for this control →
            </Link>
          }
        />
        <CardSection>
          {snapshot.latestIncidents.length === 0 ? (
            <p className="text-sm text-slate-600">
              No active incidents in the current window. Control coverage still
              applies.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {snapshot.latestIncidents.map((inc: any) => (
                <li
                  key={inc.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <Link
                      href={appendReturnTo(routeToIncident(inc.id), here)}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {inc.title}
                    </Link>
                    <p className="text-[11px] text-slate-500">
                      {inc.system_name} · {formatRelativeTime(inc.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={appendReturnTo(routeToIncident(inc.id), here)}
                      className="text-[11px] font-medium text-slate-600 hover:text-slate-900"
                    >
                      Open incident
                    </Link>
                    <AnalyzeWithBob
                      targetType="incident"
                      targetId={inc.id}
                      label="Bob analysis"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardSection>
      </Card>

      {/* Logic & scope */}
      <Card surface="evidence">
        <CardHeader
          title="Control logic and scope"
          caption="Contract-style summary of how this control is wired."
        />
        <CardSection>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <Row label="Condition" value={`${rule.observed_field} ${rule.comparator} ${rule.threshold_field}`} />
            <Row label="Scope" value="Fleet catalog membership (demo)" />
            <Row label="Environments" value="Production · Staging (inherited)" />
            <Row label="Owner" value={snapshot.ownerTeam} />
            <Row label="Reviewer" value="Governance council rotation" />
            <Row
              label="Routing policy"
              value={`Severity ${humanizeLabel(snapshot.severity)} → owning team queue`}
            />
            <Row
              label="Last signal"
              value={
                snapshot.lastTriggeredAt
                  ? formatRelativeTime(snapshot.lastTriggeredAt)
                  : "No recent fires"
              }
            />
            <Row label="Config / version" value="Policy bundle v3 (demo label)" />
          </dl>
        </CardSection>
      </Card>

      {/* Bob control review */}
      <Card>
        <CardHeader
          title="Bob control review"
          caption="Bob is bounded, policy-checked, and audit-linked; recommendations are not autonomous execution."
        />
        <CardSection>
          {bobInvestigation ? (
            <div className="space-y-3 text-sm text-slate-700">
              <p>
                <span className="font-medium text-slate-900">Likely root cause: </span>
                {bobInvestigation.likely_root_cause}
              </p>
              <p>
                <span className="font-medium text-slate-900">Why it matters: </span>
                {bobInvestigation.why_it_matters}
              </p>
              {bobInvestigation.alternative_hypothesis ? (
                <p>
                  <span className="font-medium text-slate-900">Alternative: </span>
                  {bobInvestigation.alternative_hypothesis}
                </p>
              ) : null}
              {topRec ? (
                <p>
                  <span className="font-medium text-slate-900">Top recommendation: </span>
                  {topRec.title} — {topRec.rationale_summary}
                </p>
              ) : null}
              <p className="text-xs text-slate-500">
                Confidence:{" "}
                <span className="capitalize">{bobInvestigation.confidence}</span>
              </p>
              <Link
                href={appendReturnTo(
                  routeToBobInvestigation(bobInvestigation.id),
                  here
                )}
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-900 hover:underline"
              >
                Open full Bob review
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/50 p-4 text-sm text-slate-600">
              <p>No Bob investigation is attached to this control yet.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    runDemo(
                      "Run Bob control review (bounded analysis — queued locally)"
                    )
                  }
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-800 hover:bg-slate-50"
                >
                  Run Bob control review (demo)
                </button>
                <Link
                  href={appendReturnTo(
                    routeToBobForTarget("control", snapshot.ruleId),
                    here
                  )}
                  className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50/40 px-2.5 py-1 text-[11px] font-semibold text-indigo-900 hover:bg-indigo-50"
                >
                  <BobIcon size="xs" withBackground={false} />
                  Open Bob resolver
                </Link>
              </div>
            </div>
          )}
        </CardSection>
      </Card>

      {/* Audit */}
      <DisclosureSection
        title="Audit trail"
        eyebrow="Governance record"
        summary="Control lifecycle events (demo composition from available signals)."
        defaultOpen={false}
      >
        <ul className="space-y-2 text-sm text-slate-700">
          <AuditRow
            label="Control catalog entry"
            detail={`${snapshot.ruleName} registered in governance catalog.`}
          />
          <AuditRow
            label="Incidents generated (all time)"
            detail={`${formatInteger(snapshot.totalFires)} incident records linked by rule_id.`}
          />
          {bobInvestigation ? (
            <AuditRow
              label="Bob review"
              detail={`Opened ${formatRelativeTime(bobInvestigation.created_at)} · ${bobInvestigation.title}`}
            />
          ) : null}
          {relatedActions.length > 0 ? (
            <AuditRow
              label="Tuning / routing actions"
              detail={`${formatInteger(relatedActions.length)} governed action(s) reference this control.`}
            />
          ) : (
            <AuditRow
              label="Tuning action prepared"
              detail="None in Action Center for this control in the current fetch."
            />
          )}
          <AuditRow
            label="Threshold / routing change"
            detail="No schema mutation recorded in API — treat as stable unless policy bundle updates."
          />
        </ul>
      </DisclosureSection>

      <p className="text-center text-[11px] text-slate-400">
        <Link href={routes.controls()} className="hover:text-slate-600">
          Return to catalog
        </Link>
      </p>
    </section>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
        {k}
      </div>
      <div className="truncate font-medium text-slate-800">{v}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50/60 px-2 py-1.5">
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="text-lg font-semibold tabular-nums text-slate-900">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-0.5 text-slate-800">{value}</dd>
    </div>
  );
}

function AuditRow({ label, detail }: { label: string; detail: string }) {
  return (
    <li className="rounded-md border border-slate-100 bg-white px-3 py-2">
      <div className="text-xs font-semibold text-slate-900">{label}</div>
      <p className="mt-0.5 text-xs text-slate-600">{detail}</p>
    </li>
  );
}
