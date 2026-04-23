import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { getAction, getChange, getExecutionConsole } from "@/lib/api";
import { SectionTitle } from "@/components/ui/section-title";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChangeStateBadge,
  EnvironmentChip,
  VersionChip
} from "@/components/operations/operations-badges";
import { MetricDeltaRow } from "@/components/operations/change-impact";
import { ExecutionConsole } from "@/components/operations/execution-console";
import { FlowBreadcrumb } from "@/components/shared/flow-breadcrumb";
import { formatRelativeTime, formatShortDateTime } from "@/lib/format";
import {
  outcomeNextStep,
  outcomeVerdict,
  verdictRing
} from "@/lib/governance-states";
import { cn } from "@/lib/cn";
import {
  routes,
  routeToAction,
  routeToBobInvestigation,
  routeToIncident,
  routeToOutcomesForSystem,
  routeToSystem
} from "@/lib/routes";

type Props = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export default async function OutcomeDetailPage({ params }: Props) {
  const { id } = await params;
  let change;
  try {
    const res = await getChange(id);
    change = res.item;
  } catch {
    notFound();
  }
  if (!change) notFound();

  const [actionRes, consoleRes] = await Promise.all([
    change.source_action_id
      ? getAction(change.source_action_id).catch(() => ({ item: null as any }))
      : Promise.resolve({ item: null as any }),
    change.source_action_id
      ? getExecutionConsole({ action_id: change.source_action_id }).catch(
          () => ({ items: [] as any[] })
        )
      : Promise.resolve({ items: [] as any[] })
  ]);
  const action = actionRes?.item ?? null;
  const consoleEntries = consoleRes?.items ?? [];

  const verdict = outcomeVerdict(change);
  const nextStep = outcomeNextStep(change);

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <Link
          href={routes.outcomes()}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-800"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to Outcomes
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={routeToSystem(change.target_system_id)}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:border-slate-300"
          >
            Open system · {change.target_system_name}
          </Link>
          {change.source_action_id ? (
            <Link
              href={routeToAction(change.source_action_id)}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:border-slate-300"
            >
              Open action
            </Link>
          ) : null}
        </div>
      </div>

      <FlowBreadcrumb
        steps={[
          change.source_incident_id
            ? {
                label: "Incident",
                href: routeToIncident(change.source_incident_id),
                icon: "incident"
              }
            : { label: "Incident", icon: "incident", missing: true },
          change.source_investigation_id
            ? {
                label: "Bob investigation",
                href: routeToBobInvestigation(change.source_investigation_id),
                icon: "bob"
              }
            : { label: "Bob investigation", icon: "bob", missing: true },
          change.source_action_id
            ? {
                label: "Governed action",
                href: routeToAction(change.source_action_id),
                icon: "action"
              }
            : { label: "Governed action", icon: "action", missing: true },
          { label: "Measured outcome", icon: "outcome", active: true }
        ]}
      />

      <SectionTitle
        eyebrow="Measured outcome"
        title={change.change_type}
        caption={change.change_summary}
      />

      {/* Verdict + context hero --------------------------------------------- */}
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <ChangeStateBadge state={change.impact_status} />
          <EnvironmentChip env={change.environment} />
          {change.rollback_recommended ? (
            <Badge tone="high">Rollback recommended</Badge>
          ) : null}
          {change.follow_up_required ? (
            <Badge tone="medium">Follow-up required</Badge>
          ) : null}
          <span className="ml-auto text-[11px] text-slate-500">
            Executed {formatShortDateTime(change.executed_at)} · by{" "}
            {change.changed_by_label}
          </span>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-[1.3fr_1fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Current verdict
            </p>
            <div className="mt-1 flex flex-wrap items-start gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1",
                  verdictRing[verdict.tone]
                )}
              >
                {verdict.tone === "urgent"
                  ? "Needs rollback review"
                  : verdict.tone === "warn"
                    ? "Needs follow-up"
                    : verdict.tone === "ok"
                      ? "Favorable"
                      : verdict.tone === "info"
                        ? "Measurement open"
                        : "Closed"}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-800">
              {verdict.sentence}
            </p>
            <p className="mt-2 text-[12px] text-slate-600">
              <span className="font-semibold">What happens next · </span>
              {nextStepSentence(nextStep.label, change)}
            </p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50/60 p-3 text-[12px] text-slate-700">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              <KV label="Monitoring window" value={change.monitoring_window} />
              <KV label="Baseline window" value={change.baseline_window} />
              <KV
                label="Evaluated"
                value={
                  change.evaluated_at
                    ? formatRelativeTime(change.evaluated_at)
                    : "—"
                }
              />
              <KV
                label="Rollback"
                value={
                  change.rollback_recommended
                    ? "Recommended"
                    : change.rollback_available
                      ? "Available"
                      : "No path"
                }
              />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Change executed"
              caption="What changed, between which versions or configurations."
            />
            <div className="mt-3 space-y-2 text-[12px] text-slate-700">
              <p>{change.change_summary}</p>
              {(change.version_before || change.version_after) && (
                <div className="flex flex-wrap items-center gap-2">
                  {change.version_before && (
                    <VersionChip version={change.version_before} label="prev" />
                  )}
                  <ArrowRight className="h-3 w-3 text-slate-400" />
                  {change.version_after && (
                    <VersionChip version={change.version_after} label="now" tone="info" />
                  )}
                </div>
              )}
              {change.config_before || change.config_after ? (
                <div className="grid gap-2 rounded-md border border-slate-200 bg-white p-2.5 md:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Before
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-slate-700">
                      {change.config_before ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      After
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-slate-700">
                      {change.config_after ?? "—"}
                    </p>
                  </div>
                </div>
              ) : null}
              {(change.maintenance_state_before ||
                change.maintenance_state_after) && (
                <p className="text-[11px] text-slate-500">
                  Maintenance: {change.maintenance_state_before ?? "—"} →{" "}
                  <span className="font-medium text-slate-700">
                    {change.maintenance_state_after ?? "—"}
                  </span>
                </p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Expected vs actual"
              caption="Bob&apos;s hypothesis vs measured result on watched metrics."
            />
            <div className="mt-3 grid gap-3 rounded-md border border-slate-200 bg-slate-50/50 p-3 md:grid-cols-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Bob expected
                </p>
                <p className="mt-1 text-[12px] text-slate-700">
                  {change.expected_impact_summary}
                </p>
                {change.watched_metrics.length > 0 && (
                  <p className="mt-2 text-[11px] text-slate-500">
                    Watched · {change.watched_metrics.join(" · ")}
                  </p>
                )}
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  What actually happened
                </p>
                <p className="mt-1 text-[12px] text-slate-700">
                  {change.actual_outcome_summary}
                </p>
              </div>
            </div>
            {change.metric_deltas.length > 0 && (
              <div className="mt-3">
                <p className="label-eyebrow mb-1.5">Metric movement</p>
                <div className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white px-3">
                  {change.metric_deltas.map((d) => (
                    <MetricDeltaRow key={d.metric} delta={d} />
                  ))}
                </div>
              </div>
            )}
          </Card>

          {consoleEntries.length > 0 && (
            <ExecutionConsole
              entries={consoleEntries}
              title="Execution console · this outcome"
              caption="Audit-linked steps tied to the producing action."
            />
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Outcome summary" />
            <dl className="mt-3 space-y-1.5 text-[12px]">
              <Row label="Status" value={<ChangeStateBadge state={change.impact_status} />} />
              <Row
                label="Recurrence"
                value={
                  change.recurrence_before != null && change.recurrence_after != null
                    ? `${change.recurrence_before}/wk → ${change.recurrence_after}/wk`
                    : "—"
                }
              />
              <Row
                label="Reviewer burden"
                value={
                  change.reviewer_burden_before != null &&
                  change.reviewer_burden_after != null
                    ? `${change.reviewer_burden_before}h → ${change.reviewer_burden_after}h`
                    : "—"
                }
              />
              <Row
                label="Rollback"
                value={
                  change.rollback_recommended
                    ? "Recommended"
                    : change.rollback_available
                      ? "Available"
                      : "No path"
                }
              />
              <Row
                label="Follow-up"
                value={change.follow_up_required ? "Required" : "None"}
              />
            </dl>
          </Card>

          <Card>
            <CardHeader
              title="Related context"
              caption="System, investigation, incident, and action."
            />
            <ul className="mt-2 space-y-2 text-[12px] text-slate-700">
              <RelatedRow
                label="System"
                value={change.target_system_name}
                href={routeToSystem(change.target_system_id)}
              />
              {change.source_action_id ? (
                <RelatedRow
                  label="Action"
                  value={action?.title ?? change.source_action_id}
                  href={routeToAction(change.source_action_id)}
                />
              ) : null}
              {change.source_investigation_id ? (
                <RelatedRow
                  label="Bob investigation"
                  value={change.source_investigation_id}
                  href={routeToBobInvestigation(change.source_investigation_id)}
                />
              ) : null}
              {change.source_incident_id ? (
                <RelatedRow
                  label="Incident"
                  value={change.source_incident_id}
                  href={routeToIncident(change.source_incident_id)}
                />
              ) : null}
              <RelatedRow
                label="All outcomes for this system"
                value="View"
                href={routeToOutcomesForSystem(change.target_system_id)}
              />
            </ul>
          </Card>
        </div>
      </div>
    </section>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-[12px] font-medium text-slate-800">{value}</p>
    </div>
  );
}

function Row({
  label,
  value
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[11px] uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="text-right text-[12px] text-slate-800">{value}</dd>
    </div>
  );
}

function RelatedRow({
  label,
  value,
  href
}: {
  label: string;
  value: string;
  href: string;
}) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="min-w-0 truncate">
        <span className="text-slate-500">{label}:</span> {value}
      </span>
      <Link
        href={href}
        className="shrink-0 text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:underline"
      >
        Open →
      </Link>
    </li>
  );
}

/** Expand a short next-step label into a full sentence for the hero block. */
function nextStepSentence(
  label: string,
  c: { rollback_available: boolean }
): string {
  switch (label) {
    case "Prepare rollback request":
      return c.rollback_available
        ? "Prepare a rollback request in Action Center; dual approval required before execution."
        : "Prepare a rollback request in Action Center; rollback is not currently available without restoring a prior version.";
    case "Review regression with control owner":
      return "Review the regression with the control owner; consider rollback or scope narrowing.";
    case "Open follow-up monitoring window":
      return "Open a follow-up monitoring window and re-evaluate at the next cycle.";
    case "Close outcome with reviewer sign-off":
      return "Close this outcome with reviewer sign-off; preserve the result for audit.";
    case "None — closed":
      return "No action required. Outcome closed and preserved for audit.";
    case "Monitor to end of window":
    default:
      return "Continue monitoring; re-evaluate at the end of the window.";
  }
}
