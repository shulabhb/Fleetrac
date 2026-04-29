import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { ArrowRight, ChevronLeft } from "lucide-react";
import {
  getAccessPolicy,
  getActions,
  getBobInvestigation,
  getBobInvestigations,
  getChanges,
  getIncidentDetail,
  getIncidents,
  getRules
} from "@/lib/api";
import {
  appendReturnTo,
  routes,
  routeToAction,
  routeToBobInvestigation,
  routeToControl,
  routeToIncident,
  routeToOutcome,
  safeReturnTo,
  routeToSystem
} from "@/lib/routes";
import { ExecutionEligibilityCard } from "@/components/actions/execution-eligibility";
import { LinkedActionsPanel } from "@/components/actions/linked-actions";
import { ChangesTimeline } from "@/components/operations/change-impact";
import { BobEyebrow, BobIcon } from "@/components/bob/bob-icon";
import {
  ApprovalBadge,
  ConfidenceBadge,
  InvestigationStatusBadge
} from "@/components/bob/bob-badges";
import { EvidenceList } from "@/components/bob/evidence-list";
import { InvestigationActivity } from "@/components/bob/investigation-activity";
import { RecommendationCard } from "@/components/bob/recommendation-card";
import { BobInvestigationWorkflow } from "@/components/bob/bob-workflow-panel";
import { BobInvestigationOpsConsole } from "@/components/bob/bob-investigation-ops-console";
import { DisclosureSection } from "@/components/shared/disclosure-section";
import { FlowBreadcrumb } from "@/components/shared/flow-breadcrumb";
import { formatRelativeTime, formatShortDateTime } from "@/lib/format";
import { humanizeLabel } from "@/lib/present";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ returnTo?: string }>;
};

export default async function BobInvestigationDetailPage({
  params,
  searchParams
}: Props) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const backHref = safeReturnTo(sp.returnTo, routes.bob());
  const here = `/bob/${id}`;
  let investigation;
  try {
    const res = await getBobInvestigation(id);
    investigation = res.item;
  } catch {
    notFound();
  }
  if (!investigation) notFound();

  // Gather related context for cross-linking. Failures are non-fatal — the
  // related-context panel simply omits rows it can't resolve.
  const relatedContext: {
    relatedIncidentId?: string;
    relatedIncidentTitle?: string;
    relatedSystemId?: string;
    relatedSystemLabel?: string;
    relatedControlId?: string;
    relatedControlName?: string;
    relatedControlInvestigationId?: string;
    relatedSystemInvestigationId?: string;
    openInvestigationsForSystem?: number;
  } = {};

  try {
    if (investigation.target_type === "incident") {
      const detail = await getIncidentDetail(investigation.target_id);
      relatedContext.relatedSystemId = detail.incident?.system_id;
      relatedContext.relatedSystemLabel = detail.incident?.system_name;
      relatedContext.relatedControlId = detail.incident?.rule_id;
    } else if (investigation.target_type === "system") {
      const [rulesRes, incidentsRes] = await Promise.all([
        getRules(),
        getIncidents()
      ]);
      const sysIncidents = (incidentsRes.items ?? []).filter(
        (i: any) => i.system_id === investigation.target_id
      );
      const latest = sysIncidents[0];
      if (latest) {
        relatedContext.relatedIncidentId = latest.id;
        relatedContext.relatedIncidentTitle = latest.title;
        relatedContext.relatedControlId = latest.rule_id;
        const rule = (rulesRes.items ?? []).find(
          (r: any) => r.id === latest.rule_id
        );
        if (rule) relatedContext.relatedControlName = rule.name;
      }
    } else if (investigation.target_type === "control") {
      const incidentsRes = await getIncidents();
      const ruleIncidents = (incidentsRes.items ?? []).filter(
        (i: any) => i.rule_id === investigation.target_id
      );
      const latest = ruleIncidents[0];
      if (latest) {
        relatedContext.relatedIncidentId = latest.id;
        relatedContext.relatedIncidentTitle = latest.title;
        relatedContext.relatedSystemId = latest.system_id;
        relatedContext.relatedSystemLabel = latest.system_name;
      }
    }
  } catch {
    // Non-fatal — related context just won't render.
  }

  // Resolve sibling Bob investigations (control / system) that the related
  // context panel may want to link to. Pre-resolving means the panel only
  // shows those rows when a real investigation exists, and the link can
  // bypass the `/bob/for/…` resolver entirely.
  try {
    const { items: allInvestigations } = await getBobInvestigations();
    if (
      relatedContext.relatedControlId &&
      investigation.target_type !== "control"
    ) {
      const match = (allInvestigations ?? []).find(
        (inv: any) =>
          inv.target_type === "control" &&
          inv.target_id === relatedContext.relatedControlId
      );
      if (match) relatedContext.relatedControlInvestigationId = match.id;
    }
    if (
      relatedContext.relatedSystemId &&
      investigation.target_type !== "system"
    ) {
      const match = (allInvestigations ?? []).find(
        (inv: any) =>
          inv.target_type === "system" &&
          inv.target_id === relatedContext.relatedSystemId
      );
      if (match) relatedContext.relatedSystemInvestigationId = match.id;
    }
  } catch {
    // Non-fatal.
  }

  const targetHref =
    investigation.target_type === "incident"
      ? appendReturnTo(routeToIncident(investigation.target_id), here)
      : investigation.target_type === "system"
      ? appendReturnTo(routeToSystem(investigation.target_id), here)
      : appendReturnTo(routeToControl(investigation.target_id), here);

  const top = investigation.recommendations.find(
    (r) => r.id === investigation.top_recommendation_id
  );
  const others = investigation.recommendations.filter(
    (r) => r.id !== investigation.top_recommendation_id
  );

  // Pull actions derived from this investigation plus the target system's
  // access policy so we can render Execution Eligibility without guessing.
  const [investigationActionsRes, targetSystemPolicyRes] = await Promise.all([
    getActions({ bob_investigation_id: investigation.id }).catch(() => ({
      items: [] as any[]
    })),
    investigation.target_type === "system"
      ? getAccessPolicy(investigation.target_id).catch(() => ({ item: null as any }))
      : (async () => {
          if (!relatedContext.relatedSystemId) return { item: null as any };
          try {
            return await getAccessPolicy(relatedContext.relatedSystemId);
          } catch {
            return { item: null as any };
          }
        })()
  ]);
  const investigationActions = investigationActionsRes?.items ?? [];
  const topAction = top
    ? investigationActions.find((a: any) => a.recommendation_id === top.id) ?? null
    : null;
  const targetSystemPolicy = targetSystemPolicyRes?.item ?? null;

  const changesRes = await getChanges({
    source_investigation_id: investigation.id,
    limit: 20
  }).catch(() => ({ items: [] as any[] }));
  const investigationChanges = changesRes.items ?? [];

  const firstInvestigationAction = investigationActions[0] ?? null;
  const firstInvestigationChange = investigationChanges[0] ?? null;
  const incidentForBreadcrumb =
    investigation.target_type === "incident"
      ? { id: investigation.target_id, label: investigation.target_label }
      : relatedContext.relatedIncidentId
        ? {
            id: relatedContext.relatedIncidentId,
            label: relatedContext.relatedIncidentTitle ?? ""
          }
        : null;
  const visibleEvidence = investigation.evidence.slice(0, 3);
  const hiddenEvidence = investigation.evidence.slice(3);

  return (
    <section className="space-y-5">
      <div className="flex min-h-8 items-center justify-between">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-800"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to Bob Copilot
        </Link>
        <Link
          href={targetHref}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:border-slate-300"
        >
          Return to {humanizeLabel(investigation.target_type).toLowerCase()} ·{" "}
          {investigation.target_label}
        </Link>
      </div>

      <FlowBreadcrumb
        steps={[
          incidentForBreadcrumb
            ? {
                label: "Incident",
                href: appendReturnTo(routeToIncident(incidentForBreadcrumb.id), here),
                icon: "incident"
              }
            : { label: "Incident", icon: "incident", missing: true },
          { label: "Bob investigation", icon: "bob", active: true },
          firstInvestigationAction
            ? {
                label: "Governed action",
                href: appendReturnTo(routeToAction(firstInvestigationAction.id), here),
                icon: "action"
              }
            : { label: "Governed action", icon: "action", missing: true },
          firstInvestigationChange
            ? {
                label: "Measured outcome",
                href: appendReturnTo(routeToOutcome(firstInvestigationChange.id), here),
                icon: "outcome"
              }
            : { label: "Measured outcome", icon: "outcome", missing: true }
        ]}
      />

      <div className="relative min-h-[220px] rounded-lg border border-slate-200 bg-white p-5">
        <span
          aria-hidden
          className="absolute left-0 top-5 bottom-5 w-[3px] rounded-r bg-gradient-to-b from-indigo-400 to-indigo-200"
        />
        <div className="pl-3">
          <BobEyebrow label="Immediate decision · Bob investigation" />
          <div className="mt-1.5 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                {investigation.title}
              </h1>
              <p className="mt-0.5 text-xs text-slate-500">
                {humanizeLabel(investigation.target_type)} ·{" "}
                {investigation.target_label}
                {investigation.signal_type
                  ? ` · ${investigation.signal_type} signal`
                  : ""}
                {investigation.risk_domain
                  ? ` · ${investigation.risk_domain}`
                  : ""}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] uppercase tracking-wide text-slate-400">
                Last Bob run
              </p>
              <p className="text-xs font-medium tabular-nums text-slate-700">
                {formatRelativeTime(investigation.last_bob_run_at)}
              </p>
              <p className="text-[10px] tabular-nums text-slate-400">
                Opened {formatShortDateTime(investigation.created_at)}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <InvestigationStatusBadge status={investigation.status} />
            <ConfidenceBadge
              tier={investigation.confidence}
              score={investigation.confidence_score}
            />
            {investigation.recurring_issue_flag ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200">
                Recurring pattern
              </span>
            ) : null}
            {top ? <ApprovalBadge status={top.approval_status} /> : null}
          </div>

          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-700">
            {investigation.summary}
          </p>

          <p className="mt-3 text-[12px] text-slate-600">
            <span className="font-semibold">What happens next · </span>
            Review the primary remediation path, then hand off any governed
            change to Action Center for approval-gated execution.
          </p>
        </div>
      </div>

      <BobInvestigationOpsConsole
        investigationId={investigation.id}
        title={investigation.title}
        targetLabel={investigation.target_label}
        initialStatus={investigation.status}
        activity={investigation.activity}
        recommendations={investigation.recommendations}
      />

      <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
        <div className="space-y-5">
          <section>
            <LayerHeader
              eyebrow="Immediate decision layer"
              title="Remediation paths to consider"
              caption="Drafted by Bob. Approval-gated, policy-checked, audit-linked, and reversible by default where supported."
              icon={<BobIcon size="xs" withBackground={false} />}
            />
            <div className="mt-3 space-y-2.5">
              {top ? (
                <RecommendationCard key={top.id} recommendation={top} />
              ) : null}
              {others.map((r) => (
                <RecommendationCard
                  key={r.id}
                  recommendation={r}
                  density="compact"
                />
              ))}
              {investigation.recommendations.length === 0 ? (
                <p className="rounded-md border border-dashed border-slate-200 bg-white p-4 text-center text-xs text-slate-500">
                  Bob has not drafted recommendations yet.
                </p>
              ) : null}
            </div>
          </section>

          <section>
            <LayerHeader
              eyebrow="Decision-support layer"
              title="Reasoning summary"
              caption="Why Bob believes this path is credible before it becomes a governed action."
              icon={<BobIcon size="xs" withBackground={false} />}
            />
            <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <DetailField
                  label="Likely root cause"
                  body={investigation.likely_root_cause}
                />
                <DetailField
                  label="Why it matters"
                  body={investigation.why_it_matters}
                />
              </div>
              {investigation.alternative_hypothesis ? (
                <div className="mt-3 rounded-md border border-slate-200 bg-slate-50/70 px-3 py-2.5">
                  <p className="label-eyebrow">Alternative hypothesis</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-700">
                    {investigation.alternative_hypothesis}
                  </p>
                </div>
              ) : null}
            </div>
          </section>

          <section>
            <LayerHeader
              eyebrow="Decision-support layer"
              title="Evidence reviewed"
              caption={
                hiddenEvidence.length > 0
                  ? `Showing ${visibleEvidence.length} highest-value items now; ${hiddenEvidence.length} additional evidence items available.`
                  : "Telemetry, controls, and prior incidents Bob inspected."
              }
            />
            <div className="mt-3">
              <EvidenceList evidence={visibleEvidence} />
              {hiddenEvidence.length > 0 ? (
                <DisclosureSection
                  title={`Additional evidence (${hiddenEvidence.length})`}
                  summary="Full telemetry, controls, and prior-incident references Bob reviewed."
                  className="mt-3"
                >
                  <EvidenceList evidence={hiddenEvidence} />
                </DisclosureSection>
              ) : null}
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <HandoffCard
            topTitle={top?.title ?? null}
            actionHref={
              topAction
                ? appendReturnTo(routeToAction(topAction.id), here)
                : routes.actions()
            }
            hasAction={Boolean(topAction)}
          />

          {topAction ? (
            <ExecutionEligibilityCard
              action={topAction}
              bobOperatingMode={
                targetSystemPolicy?.bob_operating_mode ?? null
              }
            />
          ) : null}

          {investigationActions.length > 0 ? (
            <LinkedActionsPanel
              actions={investigationActions}
              title="Actions from this investigation"
              caption="Recommendations that became governed actions in the Action Center."
            />
          ) : null}

          {investigationChanges.length > 0 ? (
            <section className="rounded-md border border-slate-200 bg-slate-50/40 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Changes & impact
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Measured post-remediation impact.
                  </p>
                </div>
                <Link
                  href={routes.outcomes()}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Measure in Outcomes →
                </Link>
              </div>
              <div className="mt-3">
                <ChangesTimeline changes={investigationChanges} />
              </div>
            </section>
          ) : null}

          <DisclosureSection
            eyebrow="Audit / deep-detail layer"
            title="Investigation state"
            summary="Review state and local workflow controls for this Bob investigation."
          >
            <BobInvestigationWorkflow investigation={investigation} />
          </DisclosureSection>

          <DisclosureSection
            eyebrow="Audit / deep-detail layer"
            title="Bob activity log"
            summary={`${investigation.activity.length} auditable review events recorded.`}
          >
              <InvestigationActivity events={investigation.activity} />
          </DisclosureSection>

          {(relatedContext.relatedIncidentId ||
            relatedContext.relatedSystemId ||
            relatedContext.relatedControlId) && (
            <DisclosureSection
              eyebrow="Audit / deep-detail layer"
              title="Related context"
              summary="System, incident, control, and sibling Bob reviews linked to this investigation."
              bodyClassName="text-xs text-slate-600"
            >
              <ul className="mt-2 space-y-2">
                {relatedContext.relatedSystemId &&
                investigation.target_type !== "system" ? (
                  <li className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate">
                      <span className="text-slate-400">System:</span>{" "}
                      {relatedContext.relatedSystemLabel ??
                        relatedContext.relatedSystemId}
                    </span>
                    <Link
                      href={routeToSystem(relatedContext.relatedSystemId)}
                      className="shrink-0 text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:underline"
                    >
                      View production context →
                    </Link>
                  </li>
                ) : null}
                {relatedContext.relatedIncidentId &&
                investigation.target_type !== "incident" ? (
                  <li className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate">
                      <span className="text-slate-400">Latest incident:</span>{" "}
                      {relatedContext.relatedIncidentTitle ??
                        relatedContext.relatedIncidentId}
                    </span>
                    <Link
                      href={routeToIncident(relatedContext.relatedIncidentId)}
                      className="shrink-0 text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:underline"
                    >
                      Return to incident →
                    </Link>
                  </li>
                ) : null}
                {relatedContext.relatedControlId &&
                investigation.target_type !== "control" ? (
                  <li className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate">
                      <span className="text-slate-400">Control:</span>{" "}
                      {relatedContext.relatedControlName ??
                        relatedContext.relatedControlId}
                    </span>
                    <Link
                      href={routeToControl(relatedContext.relatedControlId)}
                      className="shrink-0 text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:underline"
                    >
                      View related evidence →
                    </Link>
                  </li>
                ) : null}
                {investigation.target_type === "system" &&
                relatedContext.relatedControlId &&
                relatedContext.relatedControlInvestigationId ? (
                  <li className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate">
                      <span className="text-slate-400">
                        Related Bob control review:
                      </span>{" "}
                      {relatedContext.relatedControlName ??
                        relatedContext.relatedControlId}
                    </span>
                    <Link
                      href={routeToBobInvestigation(
                        relatedContext.relatedControlInvestigationId
                      )}
                      className="shrink-0 text-[11px] font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      Open Bob investigation →
                    </Link>
                  </li>
                ) : null}
                {investigation.target_type === "incident" &&
                relatedContext.relatedSystemId &&
                relatedContext.relatedSystemInvestigationId ? (
                  <li className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate">
                      <span className="text-slate-400">
                        Related Bob system analysis:
                      </span>{" "}
                      {relatedContext.relatedSystemLabel ??
                        relatedContext.relatedSystemId}
                    </span>
                    <Link
                      href={routeToBobInvestigation(
                        relatedContext.relatedSystemInvestigationId
                      )}
                      className="shrink-0 text-[11px] font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      Open Bob investigation →
                    </Link>
                  </li>
                ) : null}
              </ul>
            </DisclosureSection>
          )}

          <DisclosureSection
            eyebrow="Audit / deep-detail layer"
            title="About this investigation"
            summary={`Target ${humanizeLabel(investigation.target_type).toLowerCase()} · updated ${formatShortDateTime(investigation.updated_at)}`}
            bodyClassName="text-xs text-slate-600"
          >
            <dl className="mt-2 space-y-1.5">
              <Row label="Suggested owner" value={investigation.suggested_owner} />
              <Row
                label="Target"
                value={`${humanizeLabel(investigation.target_type)} · ${investigation.target_label}`}
              />
              <Row
                label="Signal type"
                value={investigation.signal_type ?? "—"}
              />
              <Row
                label="Risk domain"
                value={investigation.risk_domain ?? "—"}
              />
              <Row
                label="Last updated"
                value={formatShortDateTime(investigation.updated_at)}
              />
              <Row
                label="Created"
                value={formatShortDateTime(investigation.created_at)}
              />
            </dl>
          </DisclosureSection>
        </div>
      </div>
    </section>
  );
}

function LayerHeader({
  eyebrow,
  title,
  caption,
  icon
}: {
  eyebrow: string;
  title: string;
  caption: string;
  icon?: ReactNode;
}) {
  return (
    <header className="mb-2 flex flex-wrap items-end justify-between gap-2">
      <div>
        <p className="label-eyebrow">{eyebrow}</p>
        <h2 className="mt-0.5 flex items-center gap-2 text-sm font-semibold tracking-tight text-slate-900">
          {icon}
          {title}
        </h2>
      </div>
      <p className="max-w-md text-[11px] text-slate-500">{caption}</p>
    </header>
  );
}

function HandoffCard({
  topTitle,
  actionHref,
  hasAction
}: {
  topTitle: string | null;
  actionHref: string;
  hasAction: boolean;
}) {
  return (
    <section className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-4 text-xs text-slate-700">
      <p className="label-eyebrow text-indigo-700">What happens next</p>
      <h2 className="mt-1 text-sm font-semibold text-slate-900">
        {hasAction ? "Review the governed action" : "Create the governed handoff"}
      </h2>
      <p className="mt-1.5 leading-relaxed">
        {topTitle
          ? `Primary path: ${topTitle}. Bob can prepare the recommendation, but approval and execution stay in Action Center.`
          : "Bob has not selected a primary recommendation yet. Review evidence before routing remediation."}
      </p>
      <Link
        href={actionHref}
        className="mt-3 inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-medium text-indigo-700 hover:border-indigo-300 hover:bg-indigo-50"
      >
        {hasAction ? "Review governed action" : "Choose incident work"}
        <ArrowRight className="h-3 w-3" />
      </Link>
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
