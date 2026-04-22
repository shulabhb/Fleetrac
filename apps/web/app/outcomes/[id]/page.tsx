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
import { formatRelativeTime, formatShortDateTime } from "@/lib/format";

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

  const step = nextStep(change);
  const verdict = verdictFor(change);

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <Link
          href="/outcomes"
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-800"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to Outcomes
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/systems/${change.target_system_id}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:border-slate-300"
          >
            Open system · {change.target_system_name}
          </Link>
          {change.source_action_id ? (
            <Link
              href={`/actions/${change.source_action_id}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:border-slate-300"
            >
              Open action
            </Link>
          ) : null}
        </div>
      </div>

      <SectionTitle
        eyebrow="Outcome"
        title={change.change_type}
        caption={change.change_summary}
      />

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
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Current verdict
            </p>
            <p className="text-sm text-slate-800">{verdict}</p>
            <p className="text-[12px] text-slate-600">
              <span className="font-semibold">Next:</span> {step}
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
              <KV label="Rollback available" value={change.rollback_available ? "Yes" : "No"} />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Change executed"
              caption="What actually moved, and between which states."
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
              title="Expected vs Actual"
              caption="Bob's hypothesis at approval time, next to what actually happened."
            />
            <div className="mt-3 grid gap-3 rounded-md bg-slate-50 p-3 md:grid-cols-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Expected
                </p>
                <p className="mt-1 text-[12px] text-slate-700">
                  {change.expected_impact_summary}
                </p>
                {change.watched_metrics.length > 0 && (
                  <p className="mt-2 text-[11px] text-slate-500">
                    Watched: {change.watched_metrics.join(" · ")}
                  </p>
                )}
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Actual
                </p>
                <p className="mt-1 text-[12px] text-slate-700">
                  {change.actual_outcome_summary}
                </p>
              </div>
            </div>
            {change.metric_deltas.length > 0 && (
              <div className="mt-3 divide-y divide-slate-100 rounded-md border border-slate-200 bg-white px-3">
                {change.metric_deltas.map((d) => (
                  <MetricDeltaRow key={d.metric} delta={d} />
                ))}
              </div>
            )}
          </Card>

          {consoleEntries.length > 0 && (
            <ExecutionConsole
              entries={consoleEntries}
              title="Execution Console · this outcome"
              caption="Operational acts tied to the action that produced this outcome."
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
                      : "Unavailable"
                }
              />
              <Row
                label="Follow-up"
                value={change.follow_up_required ? "Required" : "None"}
              />
            </dl>
          </Card>

          <Card>
            <CardHeader title="Related context" />
            <ul className="mt-2 space-y-2 text-[12px] text-slate-700">
              <RelatedRow
                label="System"
                value={change.target_system_name}
                href={`/systems/${change.target_system_id}`}
              />
              {change.source_action_id ? (
                <RelatedRow
                  label="Action"
                  value={action?.title ?? change.source_action_id}
                  href={`/actions/${change.source_action_id}`}
                />
              ) : null}
              {change.source_investigation_id ? (
                <RelatedRow
                  label="Bob investigation"
                  value={change.source_investigation_id}
                  href={`/bob/${change.source_investigation_id}`}
                />
              ) : null}
              {change.source_incident_id ? (
                <RelatedRow
                  label="Incident"
                  value={change.source_incident_id}
                  href={`/incidents/${change.source_incident_id}`}
                />
              ) : null}
              <RelatedRow
                label="All outcomes for this system"
                value="View"
                href={`/outcomes?system=${change.target_system_id}`}
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

function nextStep(c: {
  impact_status: string;
  rollback_recommended: boolean;
  follow_up_required: boolean;
}): string {
  if (c.rollback_recommended || c.impact_status === "rollback_candidate")
    return "Prepare rollback request; dual approval required before execution.";
  if (c.impact_status === "regression_detected")
    return "Review regression with control owner; consider rollback or scope narrowing.";
  if (c.follow_up_required || c.impact_status === "follow_up_required")
    return "Open a follow-up monitoring window and re-evaluate at next cycle.";
  if (c.impact_status === "improvement_observed")
    return "Close outcome with reviewer sign-off.";
  if (c.impact_status === "no_material_change")
    return "Closed — no material change observed; no follow-up needed.";
  if (c.impact_status === "closed") return "Closed. Preserved for audit.";
  return "Continue monitoring; re-evaluate at end of window.";
}

function verdictFor(c: {
  impact_status: string;
  follow_up_required: boolean;
  rollback_recommended: boolean;
}): string {
  if (c.rollback_recommended || c.impact_status === "rollback_candidate")
    return "Change regressed on monitored metrics; rollback is recommended.";
  if (c.impact_status === "regression_detected")
    return "Monitored metrics worsened beyond the noise threshold.";
  if (c.impact_status === "improvement_observed")
    return "Metrics moved in the expected direction. Outcome favorable.";
  if (c.impact_status === "no_material_change")
    return "Metrics did not move materially in either direction.";
  if (c.impact_status === "follow_up_required" || c.follow_up_required)
    return "Partial movement. Reviewer follow-up or extended monitoring required.";
  if (c.impact_status === "closed") return "Outcome closed. Kept for audit.";
  return "Outcome still under measurement. Monitoring window open.";
}
