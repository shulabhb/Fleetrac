import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ShieldCheck } from "lucide-react";
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
  ExecutionStateBadge,
  MonitoringBadge,
  RiskBadge,
  bobOperatingModeLabel
} from "@/components/actions";
import { ExecutionEligibilityCard } from "@/components/actions/execution-eligibility";
import { SafetyBar } from "@/components/actions/safety-bar";
import { SectionTitle } from "@/components/ui/section-title";
import { BobIcon } from "@/components/bob/bob-icon";
import { FlowBreadcrumb } from "@/components/shared/flow-breadcrumb";
import { formatRelativeTime, formatShortDateTime } from "@/lib/format";
import {
  routes,
  routeToBobInvestigation,
  routeToControl,
  routeToIncident,
  routeToOutcome,
  routeToSystem
} from "@/lib/routes";

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

  const verdict = actionVerdict(action);
  const nextStep = actionNextStep(action);

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <Link
          href={routes.actions()}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-800"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to Action Center
        </Link>
        {action.target_system_id ? (
          <Link
            href={routeToSystem(action.target_system_id)}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:border-slate-300"
          >
            Open system · {action.target_system_name ?? action.target_system_id}
          </Link>
        ) : null}
      </div>

      <FlowBreadcrumb
        steps={[
          action.related_incident_id
            ? {
                label: "Incident",
                href: routeToIncident(action.related_incident_id),
                icon: "incident"
              }
            : { label: "Incident", icon: "incident", missing: true },
          investigation
            ? {
                label: "Bob investigation",
                href: routeToBobInvestigation(investigation.id),
                icon: "bob"
              }
            : { label: "Bob investigation", icon: "bob", missing: true },
          { label: "Governed action", icon: "action", active: true },
          change
            ? {
                label: "Measured outcome",
                href: routeToOutcome(change.id),
                icon: "outcome"
              }
            : { label: "Measured outcome", icon: "outcome", missing: true }
        ]}
      />

      <SectionTitle
        eyebrow="Governed action"
        title={action.title}
        caption={action.action_scope}
      />

      {/* Hero: status + verdict + what-happens-next + safety bar ------------ */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <ExecutionStateBadge state={action.execution_status} />
          <ApprovalStateBadge state={action.approval_status} />
          <RiskBadge risk={action.risk_level} />
          <MonitoringBadge status={action.monitoring_status} />
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Current verdict
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-800">
              {verdict}
            </p>
            <p className="mt-2 text-[12px] text-slate-600">
              <span className="font-semibold">What happens next · </span>
              {nextStep}
            </p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50/60 p-3 text-[12px] text-slate-700">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              <KV label="Required approver" value={action.required_approver} />
              <KV label="Suggested owner" value={action.recommended_owner} />
              <KV
                label="Blast radius"
                value={action.blast_radius.replace(/_/g, " ")}
              />
              <KV
                label="Reversibility"
                value={action.reversible ? "Reversible" : "Not reversible"}
              />
            </div>
          </div>
        </div>

        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-700">
          {action.prepared_change_summary}
        </p>

        <div className="mt-4">
          <p className="label-eyebrow mb-1.5">Why this is safe to approve</p>
          <SafetyBar
            approvalGated={action.approval_status !== "not_required"}
            policyAllowed={action.allowed_by_policy}
            reversible={action.reversible}
            blastRadius={action.blast_radius}
            riskLevel={action.risk_level}
            rollbackAvailable={change?.rollback_available}
          />
        </div>

        {action.blocked_reason ? (
          <div className="mt-4 rounded-md border border-rose-100 bg-rose-50/60 px-3 py-2 text-xs text-rose-700">
            <span className="font-semibold">Blocked by policy · </span>
            {action.blocked_reason}
          </div>
        ) : null}

        {action.rejection_reason ? (
          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-600">
            <span className="font-semibold">Rejected · </span>
            {action.rejection_reason}
            {action.alternative_suggestion ? (
              <>
                {" · "}Alternative path: {action.alternative_suggestion}
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
              <p className="mt-0.5 text-xs text-slate-500">
                Bob's hypothesis for why this change could help, drawn from the
                source investigation.
              </p>
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
                  href={routeToBobInvestigation(investigation.id)}
                  className="font-medium text-indigo-700 hover:text-indigo-900 hover:underline"
                >
                  Open full Bob investigation →
                </Link>
              </div>
            </section>
          ) : null}

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-semibold text-slate-900">
                Execution bounds
              </h3>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Policy-defined limits on this change. Approval-gated, bounded,
              audit-linked.
            </p>
            <ul className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-700 md:grid-cols-2">
              <BoundaryRow
                label="Reversibility"
                value={action.reversible ? "Reversible" : "Not reversible"}
              />
              <BoundaryRow
                label="Blast radius"
                value={formatBlast(action.blast_radius)}
              />
              <BoundaryRow
                label="Risk classification"
                value={capitalize(action.risk_level)}
              />
              <BoundaryRow
                label="Execution mode"
                value={formatExec(action.execution_mode)}
              />
              <BoundaryRow
                label="Suggested by"
                value={capitalize(action.suggested_by)}
              />
              <BoundaryRow
                label="Bob operating mode"
                value={
                  policy ? bobOperatingModeLabel(policy.bob_operating_mode) : "—"
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
            <p className="mt-0.5 text-[11px] text-slate-500">
              Investigation, incident, control, and system this action was drawn
              from.
            </p>
            <ul className="mt-2 space-y-2">
              {action.bob_investigation_id ? (
                <RelatedRow
                  label="Bob investigation"
                  value={investigation?.title ?? action.bob_investigation_id}
                  href={routeToBobInvestigation(action.bob_investigation_id)}
                />
              ) : null}
              {action.related_incident_id ? (
                <RelatedRow
                  label="Incident"
                  value={action.related_incident_id}
                  href={routeToIncident(action.related_incident_id)}
                />
              ) : null}
              {action.target_system_id ? (
                <RelatedRow
                  label="System"
                  value={action.target_system_name ?? action.target_system_id}
                  href={routeToSystem(action.target_system_id)}
                />
              ) : null}
              {action.related_control_id ? (
                <RelatedRow
                  label="Control"
                  value={action.related_control_id}
                  href={routeToControl(action.related_control_id)}
                />
              ) : null}
              {change ? (
                <RelatedRow
                  label="Measured outcome"
                  value="View in Outcomes"
                  href={routeToOutcome(change.id)}
                />
              ) : null}
            </ul>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 text-xs text-slate-600">
            <p className="label-eyebrow">About this action</p>
            <dl className="mt-2 space-y-1.5">
              <Row
                label="Action type"
                value={action.action_type.replace(/_/g, " ")}
              />
              <Row
                label="Source"
                value={action.source_type.replace(/_/g, " ")}
              />
              <Row
                label="Confidence"
                value={`${capitalize(action.confidence)} · ${Math.round(action.confidence_score * 100)}%`}
              />
              <Row label="Created" value={formatShortDateTime(action.created_at)} />
              <Row label="Updated" value={formatShortDateTime(action.updated_at)} />
              {action.executed_at ? (
                <Row
                  label="Executed"
                  value={`${formatShortDateTime(action.executed_at)} · ${formatRelativeTime(action.executed_at)}`}
                />
              ) : null}
              {action.monitored_until ? (
                <Row
                  label="Monitored until"
                  value={formatShortDateTime(action.monitored_until)}
                />
              ) : null}
            </dl>
          </section>
        </div>
      </div>

      {change ? (
        <section className="space-y-2">
          <SectionTitle
            eyebrow="Measure · Post-execution"
            title="Expected vs actual"
            caption="Expected vs actual on monitored metrics, with follow-up or rollback state."
            actions={
              <Link
                href={routeToOutcome(change.id)}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-slate-300"
              >
                Open in Outcomes →
              </Link>
            }
          />
          <ChangeImpactCard change={change} />
        </section>
      ) : null}

      {consoleEntries.length > 0 ? (
        <ExecutionConsole
          entries={consoleEntries}
          title="Execution console · this action"
          caption="Audit-linked steps Bob prepared or executed."
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

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-[12px] font-medium text-slate-800">{value}</p>
    </div>
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

/** High-signal one-liner that summarizes where this action sits. */
function actionVerdict(a: {
  execution_status: string;
  allowed_by_policy: boolean;
  approval_status: string;
  risk_level: string;
}): string {
  if (!a.allowed_by_policy)
    return "Blocked by policy. Held on the queue with an audit-linked record of the blocking reason.";
  switch (a.execution_status) {
    case "drafted":
    case "prepared":
      return "Prepared by Bob. Nothing executes until a human approves within policy.";
    case "awaiting_approval":
      return a.risk_level === "high"
        ? "High-risk change prepared. Dual approval required before execution."
        : "Prepared within policy. Awaiting a governance approver.";
    case "approved":
    case "ready_to_execute":
      return "Approved within policy. Cleared for bounded execution.";
    case "executed":
      return "Executed within approved scope. Measured impact is in Outcomes.";
    case "monitoring_outcome":
      return "Executed. Monitoring window open on watched metrics.";
    case "follow_up_required":
      return "Executed with partial or ambiguous outcome. Reviewer follow-up open.";
    case "rejected":
      return "Rejected by the approver. Preserved for audit.";
    case "reverted":
      return "Executed change was reverted. See Outcomes for the reason.";
    case "closed":
      return "Closed. Preserved for audit.";
    default:
      return "Governed action, awaiting next step.";
  }
}

function actionNextStep(a: {
  execution_status: string;
  allowed_by_policy: boolean;
  risk_level: string;
  required_approver: string;
}): string {
  if (!a.allowed_by_policy)
    return "Resolve the policy blocker, or accept the audit record and close.";
  switch (a.execution_status) {
    case "drafted":
    case "prepared":
    case "awaiting_approval":
      return a.risk_level === "high"
        ? `Route to ${a.required_approver} for dual approval.`
        : `Route to ${a.required_approver} for approval.`;
    case "approved":
    case "ready_to_execute":
      return "Hand off to the owner or execute within the permitted window.";
    case "executed":
    case "monitoring_outcome":
      return "Monitor until end of window, then review in Outcomes.";
    case "follow_up_required":
      return "Open a follow-up review and decide: extend monitoring or narrow scope.";
    case "rejected":
      return "No action required. Audit record retained.";
    case "reverted":
      return "Confirm rollback closed out in Outcomes.";
    case "closed":
      return "No action required. Closed.";
    default:
      return "Continue through the governance workflow.";
  }
}
