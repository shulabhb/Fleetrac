import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import {
  getAccessPolicy,
  getAction,
  getBobInvestigation,
  getChangeForAction,
  getExecutionConsole
} from "@/lib/api";
import { ChangeImpactCard } from "@/components/operations/change-impact";
import { ExecutionConsole } from "@/components/operations/execution-console";
import {
  ApprovalStateBadge,
  BlastRadiusBadge,
  ExecutionStateBadge,
  MonitoringBadge,
  ReversibleBadge,
  RiskBadge,
  bobOperatingModeLabel
} from "@/components/actions";
import { ExecutionEligibilityCard } from "@/components/actions/execution-eligibility";
import { SectionTitle } from "@/components/ui/section-title";
import { BobIcon } from "@/components/bob/bob-icon";
import { formatRelativeTime, formatShortDateTime } from "@/lib/format";

type Props = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function ActionDetailPage({ params }: Props) {
  const { id } = await params;
  let actionRes;
  try {
    actionRes = await getAction(id);
  } catch {
    notFound();
  }
  const action = actionRes?.item;
  if (!action) notFound();

  const [policyRes, investigationRes, changeRes, consoleRes] = await Promise.all([
    action.target_system_id
      ? getAccessPolicy(action.target_system_id).catch(() => ({ item: null as any }))
      : Promise.resolve({ item: null as any }),
    action.bob_investigation_id
      ? getBobInvestigation(action.bob_investigation_id).catch(() => ({ item: null as any }))
      : Promise.resolve({ item: null as any }),
    getChangeForAction(action.id).catch(() => ({ item: null as any })),
    getExecutionConsole({ action_id: action.id }).catch(() => ({
      items: [] as any[]
    }))
  ]);
  const policy = policyRes?.item ?? null;
  const investigation = investigationRes?.item ?? null;
  const change = changeRes?.item ?? null;
  const consoleEntries = consoleRes?.items ?? [];

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <Link
          href="/actions"
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-800"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to Action Center
        </Link>
        {action.target_system_id ? (
          <Link
            href={`/systems/${action.target_system_id}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:border-slate-300"
          >
            Open system · {action.target_system_name ?? action.target_system_id}
          </Link>
        ) : null}
      </div>

      <SectionTitle
        eyebrow="Governed Action"
        title={action.title}
        caption={action.action_scope}
      />

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <ExecutionStateBadge state={action.execution_status} />
          <ApprovalStateBadge state={action.approval_status} />
          <RiskBadge risk={action.risk_level} />
          <ReversibleBadge reversible={action.reversible} />
          <BlastRadiusBadge radius={action.blast_radius} />
          <MonitoringBadge status={action.monitoring_status} />
        </div>

        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-700">
          {action.prepared_change_summary}
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <DetailField label="Target system" body={action.target_system_name ?? "—"} />
          <DetailField label="Suggested owner" body={action.recommended_owner} />
          <DetailField label="Required approver" body={action.required_approver} />
          <DetailField label="Approval policy" body={action.approval_policy} />
          {action.executed_at ? (
            <DetailField
              label="Executed"
              body={`${formatShortDateTime(action.executed_at)} · ${formatRelativeTime(action.executed_at)}`}
            />
          ) : null}
          {action.monitored_until ? (
            <DetailField
              label="Monitored until"
              body={formatShortDateTime(action.monitored_until)}
            />
          ) : null}
        </div>

        {action.blocked_reason ? (
          <div className="mt-4 rounded-md border border-rose-100 bg-rose-50/60 px-3 py-2 text-xs text-rose-700">
            <span className="font-semibold">Policy block:</span>{" "}
            {action.blocked_reason}
          </div>
        ) : null}

        {action.rejection_reason ? (
          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-600">
            <span className="font-semibold">Rejected:</span>{" "}
            {action.rejection_reason}
            {action.alternative_suggestion ? (
              <>
                {" · "}Alternative: {action.alternative_suggestion}
              </>
            ) : null}
          </div>
        ) : null}

        {action.monitoring_note ? (
          <div className="mt-4 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
            <span className="label-eyebrow">Outcome note · </span>
            {action.monitoring_note}
          </div>
        ) : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
        <div className="space-y-5">
          {investigation ? (
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <BobIcon size="xs" withBackground={false} />
                <h3 className="text-sm font-semibold text-slate-900">
                  Why Bob proposed this
                </h3>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-700">
                {investigation.summary}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <DetailField
                  label="Likely root cause"
                  body={investigation.likely_root_cause}
                />
                <DetailField
                  label="Why it matters"
                  body={investigation.why_it_matters}
                />
              </div>
              <div className="mt-3 border-t border-slate-100 pt-2 text-[11px]">
                <Link
                  href={`/bob/${investigation.id}`}
                  className="font-medium text-indigo-700 hover:text-indigo-900 hover:underline"
                >
                  Open full Bob investigation →
                </Link>
              </div>
            </section>
          ) : null}

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Safety & boundary
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Bounds that make this action safe to approve or execute.
            </p>
            <ul className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-700 md:grid-cols-2">
              <BoundaryRow label="Reversibility" value={action.reversible ? "Reversible" : "Not reversible"} />
              <BoundaryRow label="Blast radius" value={formatBlast(action.blast_radius)} />
              <BoundaryRow label="Risk classification" value={capitalize(action.risk_level)} />
              <BoundaryRow label="Execution mode" value={formatExec(action.execution_mode)} />
              <BoundaryRow label="Suggested by" value={capitalize(action.suggested_by)} />
              <BoundaryRow
                label="Bob operating mode"
                value={
                  policy
                    ? bobOperatingModeLabel(policy.bob_operating_mode)
                    : "—"
                }
              />
            </ul>
          </section>
        </div>

        <div className="space-y-5">
          <ExecutionEligibilityCard
            action={action}
            bobOperatingMode={policy?.bob_operating_mode ?? null}
          />

          <section className="rounded-lg border border-slate-200 bg-white p-4 text-xs text-slate-600">
            <p className="label-eyebrow">Related context</p>
            <ul className="mt-2 space-y-2">
              {action.bob_investigation_id ? (
                <RelatedRow
                  label="Bob investigation"
                  value={investigation?.title ?? action.bob_investigation_id}
                  href={`/bob/${action.bob_investigation_id}`}
                />
              ) : null}
              {action.related_incident_id ? (
                <RelatedRow
                  label="Incident"
                  value={action.related_incident_id}
                  href={`/incidents/${action.related_incident_id}`}
                />
              ) : null}
              {action.target_system_id ? (
                <RelatedRow
                  label="System"
                  value={action.target_system_name ?? action.target_system_id}
                  href={`/systems/${action.target_system_id}`}
                />
              ) : null}
              {action.related_control_id ? (
                <RelatedRow
                  label="Control"
                  value={action.related_control_id}
                  href={`/controls?q=${encodeURIComponent(action.related_control_id)}`}
                />
              ) : null}
            </ul>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 text-xs text-slate-600">
            <p className="label-eyebrow">About this action</p>
            <dl className="mt-2 space-y-1.5">
              <Row label="Action type" value={action.action_type.replace(/_/g, " ")} />
              <Row label="Source" value={action.source_type.replace(/_/g, " ")} />
              <Row label="Confidence" value={`${capitalize(action.confidence)} · ${Math.round(action.confidence_score * 100)}%`} />
              <Row label="Created" value={formatShortDateTime(action.created_at)} />
              <Row label="Updated" value={formatShortDateTime(action.updated_at)} />
            </dl>
          </section>
        </div>
      </div>

      {change ? (
        <section className="space-y-2">
          <SectionTitle
            eyebrow="Expected vs Actual"
            title="Change & Impact"
            caption="What Bob expected, what actually moved on monitored metrics, and whether this needs follow-up or rollback."
          />
          <ChangeImpactCard change={change} />
        </section>
      ) : null}

      {consoleEntries.length > 0 ? (
        <ExecutionConsole
          entries={consoleEntries}
          title="Execution Console · this action"
          caption="Operational acts Bob prepared or executed for this action."
        />
      ) : null}
    </section>
  );
}

function DetailField({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <p className="label-eyebrow mb-1">{label}</p>
      <p className="text-sm leading-relaxed text-slate-700">{body}</p>
    </div>
  );
}

function BoundaryRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-start justify-between gap-2 rounded-md border border-slate-100 bg-slate-50/50 px-2.5 py-1.5">
      <span className="text-[11px] uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <span className="text-xs font-medium text-slate-700">{value}</span>
    </li>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-[11px] uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="text-right text-xs font-medium text-slate-700">{value}</dd>
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
        <span className="text-slate-400">{label}:</span> {value}
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

function capitalize(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function formatBlast(b: string) {
  return b.replace(/_/g, " ");
}

function formatExec(m: string) {
  return m.replace(/_/g, " ");
}
