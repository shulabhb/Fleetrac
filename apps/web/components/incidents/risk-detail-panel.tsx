"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { FleetracAnalysisPanel } from "@/components/fleetrac/fleetrac-analysis-panel";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import {
  fetchSeverityHistory,
  type EvidenceRecordDTO,
  type GovernedActionDTO,
  type SeverityHistoryItemDTO
} from "@/lib/governance-api";
import type { QueueTableRow } from "@/lib/incident-queue-types";
import {
  resolveActionVerificationUx,
  verificationToneClass
} from "@/lib/action-verification-ux";
import { primaryApiActions } from "@/lib/governance-actions-merge";
import {
  evidenceSupportSentence,
  formatMetricBreach,
  impactExplanation,
  riskDetailCta,
  verificationPendingCopy
} from "@/lib/risk-detail-copy";
import { routeToEvidenceLibraryIncidentRecord, routes } from "@/lib/routes";

function severityTone(severity: string): "high" | "medium" | "low" | "info" {
  const s = severity.toLowerCase();
  if (s.includes("critical") || s.includes("high")) return "high";
  if (s.includes("medium")) return "medium";
  if (s.includes("low")) return "low";
  return "info";
}

function confidenceLabel(
  value: string | number | null | undefined
): "High" | "Medium" | "Low" {
  if (typeof value === "number") {
    if (value >= 0.8) return "High";
    if (value >= 0.6) return "Medium";
    return "Low";
  }
  const s = String(value ?? "").toLowerCase();
  if (s.includes("high")) return "High";
  if (s.includes("low")) return "Low";
  return "Medium";
}

function findLinkedAction(
  actions: GovernedActionDTO[],
  row: QueueTableRow
): GovernedActionDTO | null {
  const matches = actions.filter(
    (a) =>
      a.alias_id === row.incidentId ||
      a.incident_id === row.incidentId ||
      a.incident_id === row.canonicalId ||
      a.alias_id === row.canonicalId
  );
  return primaryApiActions(matches)[0] ?? null;
}

function actionStatusCopy(action: GovernedActionDTO | null): {
  label: string;
  detail: string;
  cta: string;
  tone: "amber" | "indigo" | "emerald" | "rose" | "slate";
} {
  if (!action) {
    return {
      label: "No governed action yet",
      detail: "Send a bounded action to Action Center when ready.",
      cta: "Send to Action Center",
      tone: "slate"
    };
  }
  const ux = resolveActionVerificationUx({
    status: action.status,
    rawVerificationStatus: action.verification_status,
    verificationStatus: action.verification_status,
    incidentId: action.alias_id ?? action.incident_id
  });
  return {
    label: ux.statusLine,
    detail: `${ux.decisionLabel} · ${ux.verificationLabel}`,
    cta: riskDetailCta(action.status, action.verification_status),
    tone: ux.tone
  };
}

type Props = {
  row: QueueTableRow;
  evidence: EvidenceRecordDTO | null | undefined;
  actions: GovernedActionDTO[];
  scopeHref: (path: string) => string;
  onSendToActionCenter: () => void;
  sending?: boolean;
};

export function RiskDetailPanel({
  row,
  evidence,
  actions,
  scopeHref,
  onSendToActionCenter,
  sending = false
}: Props) {
  const [history, setHistory] = useState<SeverityHistoryItemDTO[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const analysis = evidence?.fleetrac_analysis;
  const linkedAction = useMemo(() => findLinkedAction(actions, row), [actions, row]);
  const actionCopy = actionStatusCopy(linkedAction);

  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);
    void fetchSeverityHistory(row.incidentId).then((res) => {
      if (cancelled) return;
      setHistory(res?.items ?? []);
      setHistoryLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [row.incidentId]);

  const whyThisMatters =
    analysis?.why_this_severity?.length
      ? analysis.why_this_severity
      : row.severityReason
        ? [row.severityReason]
        : analysis?.evidence_highlights?.slice(0, 3) ?? [];

  const whyNotHigher = analysis?.why_not_higher ?? [];
  const recommended =
    analysis?.recommended_bounded_action ||
    analysis?.recommended_actions?.[0] ||
    row.recommendedAction;

  const evidenceHref = scopeHref(
    routeToEvidenceLibraryIncidentRecord(row.incidentId, row.ownerTeam)
  );
  const actionTab = (() => {
    if (!linkedAction) return "pending";
    const ux = resolveActionVerificationUx({
      status: linkedAction.status,
      rawVerificationStatus: linkedAction.verification_status,
      verificationStatus: linkedAction.verification_status
    });
    if (ux.lane === "verification_result") return "closed";
    if (ux.lane === "ready_to_verify") return "ready";
    return "pending";
  })();
  const actionHref = linkedAction
    ? scopeHref(
        `${routes.actions()}?action=${encodeURIComponent(linkedAction.id)}&tab=${actionTab}`
      )
    : scopeHref(routes.actions());
  const verificationPending =
    !linkedAction ||
    actionCopy.cta === "Verify impact" ||
    actionCopy.cta === "Review governed action";
  return (
    <div className="flex max-h-[min(80vh,52rem)] flex-col overflow-hidden">
      <div className="shrink-0 border-b border-slate-100 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Risk Detail · {row.incidentId}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <h2 className="text-[15px] font-semibold leading-snug text-slate-900">{row.title}</h2>
          <Badge tone={severityTone(row.severityLabel)} size="xs">
            {row.severityLabel}
          </Badge>
          <Badge tone="info" size="xs">
            {row.stage}
          </Badge>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px]">
          <div>
            <dt className="text-slate-500">Agent</dt>
            <dd className="font-medium text-slate-900">
              {row.systemName}
              <span className="font-normal text-slate-500"> · {row.systemId}</span>
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Owner</dt>
            <dd className="font-medium text-slate-900">{row.responderTeam ?? row.ownerTeam}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Last seen</dt>
            <dd className="font-medium text-slate-900">{row.updatedLabel ?? row.ageLabel}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Next step</dt>
            <dd className="font-medium text-slate-900">{actionCopy.cta}</dd>
          </div>
        </dl>
        <div className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Control breached
          </p>
          <p className="mt-1 text-[12px] font-medium leading-snug text-slate-900">
            {formatMetricBreach(row)}
          </p>
          <p className="mt-1 text-[11px] text-slate-600">
            {row.controlName ?? "Governance control"}
            {row.controlId ? ` · ${row.controlId}` : ""}
            {" · 15-minute correlation window"}
            {row.eventCount != null ? ` · ${row.eventCount} related events` : ""}
          </p>
        </div>

        {/* Governed action status — closes the Risk → Action → Verify loop */}
        <div className="mt-3 rounded-md border border-slate-200 bg-slate-50/70 px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Governed action
              </p>
              <p className="mt-0.5 text-[12px] font-medium leading-snug text-slate-900">
                {linkedAction?.title ?? "No governed action yet"}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] font-medium text-slate-900">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                    verificationToneClass(actionCopy.tone)
                  )}
                >
                  {actionCopy.detail}
                </span>
              </p>
              {linkedAction?.expected_metric ? (
                <p className="mt-0.5 text-[11px] text-slate-600">
                  Expected metric: {linkedAction.expected_metric.replace(/_/g, " ")}{" "}
                  {linkedAction.expected_direction === "increase" ? "to rise" : "to fall"}
                </p>
              ) : null}
            </div>
            {linkedAction ? (
              <Link
                href={actionHref}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-800 shadow-sm transition hover:border-slate-300"
              >
                {actionCopy.cta}
                <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
        <section>
          <FleetracAnalysisPanel
            compact
            summary={
              analysis?.summary ??
              (row.evidenceSummary || undefined)
            }
            confidence={confidenceLabel(
              analysis?.assessment_confidence ?? analysis?.confidence
            )}
            recommendedAction={recommended}
          />
        </section>

        <section>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Why this matters
          </p>
          <p className="mt-1 text-[12px] leading-snug text-slate-800">
            {impactExplanation(row.riskCategory)}
          </p>
          {whyThisMatters.length ? (
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[12px] text-slate-700">
              {whyThisMatters.slice(0, 3).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[12px] text-slate-500">
              Severity reason not yet assessed for this risk.
            </p>
          )}
          {whyNotHigher.length ? (
            <p className="mt-2 text-[11px] text-slate-500">
              <span className="font-medium text-slate-600">Why not higher:</span>{" "}
              {whyNotHigher[0]}
            </p>
          ) : null}
        </section>

        <section>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Evidence supporting this risk
            </p>
            <Link
              href={evidenceHref}
              className="text-[10px] font-semibold text-slate-600 underline underline-offset-2 hover:text-slate-900"
            >
              Outcomes audit
            </Link>
          </div>
          <p className="mt-1 text-[12px] leading-snug text-slate-800">
            {evidenceSupportSentence(evidence?.items?.length ?? row.evidenceItemsCount ?? 0)}
          </p>
          {evidence?.items?.length ? (
            <>
              <ul className="mt-1.5 space-y-1.5">
                {evidence.items.slice(0, 3).map((item) => (
                  <li
                    key={item.id}
                    className="rounded border border-slate-100 bg-slate-50/70 px-2.5 py-1.5 text-[11px] text-slate-700"
                  >
                    <p className="leading-snug text-slate-700">{item.summary}</p>
                    {item.trace_id ? (
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        Trace {item.trace_id.slice(0, 12)}
                        {item.operation_type ? ` · ${item.operation_type}` : ""}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
              <details className="mt-1.5 text-[11px] text-slate-500">
                <summary className="cursor-pointer font-medium text-slate-600">
                  Trace references
                </summary>
                <ul className="mt-1 space-y-0.5 pl-1">
                  {evidence.items.slice(0, 5).map((item) => (
                    <li key={`${item.id}-ref`}>
                      {item.trace_id
                        ? `${item.kind} · ${item.trace_id.slice(0, 12)}`
                        : `${item.kind} · ${item.reference_id.slice(0, 8)}`}
                    </li>
                  ))}
                </ul>
              </details>
            </>
          ) : null}
          <p className="mt-1.5 text-[10px] leading-snug text-slate-500">
            Decision evidence stays on this Risk Detail. Outcomes is optional historical audit —
            not a separate primary workflow step.
          </p>
        </section>

        <section>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Severity history
          </p>
          {historyLoading ? (
            <p className="mt-1 text-[12px] text-slate-500">Loading severity history…</p>
          ) : history.length ? (
            <ol className="mt-1.5 space-y-1.5 border-l border-slate-200 pl-3">
              {history.map((h) => (
                <li key={h.id} className="text-[11px] text-slate-700">
                  <span className="font-medium">
                    {h.previous_severity} → {h.new_severity}
                  </span>
                  <span className="text-slate-400"> · </span>
                  <span className="text-slate-500">
                    {new Date(h.changed_at).toLocaleString()}
                  </span>
                  <p className="text-slate-600">{h.reason}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-1 text-[12px] text-slate-500">
              No severity changes recorded yet
              {row.highestSeverity ? ` · highest seen: ${row.highestSeverity}` : ""}.
            </p>
          )}
        </section>

        <section>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Recommended action
          </p>
          <p className="mt-1 text-[12px] text-slate-800">{recommended}</p>
        </section>

        <section>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Verification
          </p>
          {verificationPending ? (
            <p className="mt-1 text-[12px] text-slate-700">
              {verificationPendingCopy(Boolean(linkedAction), actionCopy.cta === "Verify impact")}
            </p>
          ) : (
            <div className="mt-1 space-y-1 text-[12px] text-slate-800">
              <p className="font-medium">{actionCopy.detail}</p>
              <p>
                Before {String(row.worstObservedValue ?? "—")} · latest{" "}
                {String(row.latestObservedValue ?? "—")}
                {row.thresholdValue != null ? ` · threshold ${row.thresholdValue}` : ""}
              </p>
              <p className="text-[11px] text-slate-600">
                This records the verification result. It does not mean the agent was automatically remediated.
              </p>
            </div>
          )}
          {linkedAction ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <Link
                href={actionHref}
                className="text-[11px] font-semibold text-slate-800 underline underline-offset-2 hover:text-slate-600"
              >
                {actionCopy.cta}
              </Link>
              <Link
                href={evidenceHref}
                className="text-[11px] font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
              >
                Outcomes audit
              </Link>
            </div>
          ) : null}
        </section>
      </div>

      <div className="shrink-0 space-y-2 border-t border-slate-100 px-4 py-3">
        {!linkedAction ? (
          <button
            type="button"
            disabled={sending}
            onClick={onSendToActionCenter}
            className={cn(
              "flex w-full items-center justify-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:bg-slate-800",
              sending && "opacity-60"
            )}
          >
            Send governed action for review
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : (
          <Link
            href={actionHref}
            className="flex w-full items-center justify-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            {actionCopy.cta}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        )}
        <Link
          href={scopeHref(routes.liveSignals())}
          className="block w-full text-center text-[11px] font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
        >
          Inspect telemetry
        </Link>
      </div>
    </div>
  );
}
