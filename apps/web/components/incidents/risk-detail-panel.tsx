"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { FleetracAnalysisPanel } from "@/components/fleetrac/fleetrac-analysis-panel";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import {
  fetchSeverityHistory,
  postApproveAction,
  postRejectAction,
  postVerifyAction,
  type EvidenceRecordDTO,
  type GovernedActionDTO,
  type SeverityHistoryItemDTO
} from "@/lib/governance-api";
import type { QueueTableRow } from "@/lib/incident-queue-types";
import {
  flagshipVerifyHint,
  resolveActionVerificationUx
} from "@/lib/action-verification-ux";
import { primaryApiActions } from "@/lib/governance-actions-merge";
import {
  evidenceSupportSentence,
  formatMetricBreach,
  impactExplanation,
  riskDetailCta,
  riskDetailCtaTab
} from "@/lib/risk-detail-copy";
import {
  codeInvestigationFromSignals,
  governancePhases,
  uncertaintyFromConfidence,
  type GovernancePhase,
  type PhaseState
} from "@/lib/risk-triage";
import { routeToEvidenceLibraryIncidentRecord, routes } from "@/lib/routes";
import { resolveIncidentLifecycle } from "@/lib/resolve-next-step";
import { NextRequiredStepCard } from "@/components/governance/next-required-step";
import { PlainLanguageEvidence } from "@/components/governance/plain-language-evidence";

const TABS = [
  { id: "summary", label: "Summary" },
  { id: "evidence", label: "Evidence" },
  { id: "code", label: "Code" },
  { id: "decision", label: "Decision" },
  { id: "verification", label: "Verification" },
  { id: "history", label: "History" }
] as const;

const VERIFY_OUTCOMES = [
  {
    id: "improvement_observed",
    label: "Improvement observed",
    summary: "Post-approval telemetry moved in the expected direction."
  },
  {
    id: "no_material_change",
    label: "No material change",
    summary: "The metric did not move enough to close the risk."
  },
  {
    id: "regression_detected",
    label: "Follow-up required",
    summary: "The signal worsened after approval."
  },
  {
    id: "rollback_candidate",
    label: "Rollback candidate",
    summary: "Review the rollback path. This does not roll back agent code."
  }
] as const;

type LocalNote = { title: string; when: string; note: string };

const DRAWER_DEFAULT_WIDTH = 576;
const DRAWER_MIN_WIDTH = 420;

function drawerMaxWidth(): number {
  if (typeof window === "undefined") return 960;
  return Math.floor(window.innerWidth * 0.75);
}

function clampDrawerWidth(value: number): number {
  const max = drawerMaxWidth();
  const min = Math.min(DRAWER_MIN_WIDTH, max);
  return Math.min(max, Math.max(min, value));
}

export type RiskDrawerTab = (typeof TABS)[number]["id"];
type TabId = RiskDrawerTab;

function severityTone(severity: string): "critical" | "high" | "medium" | "low" | "info" {
  const s = severity.toLowerCase();
  if (s.includes("critical")) return "critical";
  if (s.includes("high")) return "high";
  if (s.includes("medium")) return "medium";
  if (s.includes("low")) return "low";
  return "info";
}

function findLinkedAction(
  actions: GovernedActionDTO[],
  row: QueueTableRow
): GovernedActionDTO | null {
  const matches = actions.filter(
    (action) =>
      action.alias_id === row.incidentId ||
      action.incident_id === row.incidentId ||
      action.incident_id === row.canonicalId ||
      action.alias_id === row.canonicalId
  );
  return primaryApiActions(matches)[0] ?? null;
}

function phaseMark(state: PhaseState): string {
  if (state === "complete") return "Done";
  if (state === "current") return "Current";
  if (state === "rejected") return "Rejected";
  if (state === "unavailable") return "Not connected";
  return "Not yet";
}

function historyLabel(entry: Record<string, unknown>): { title: string; when: string; note: string } {
  const title = String(entry.to ?? entry.lifecycle ?? entry.stage ?? "Update");
  const when = String(entry.at ?? entry.changed_at ?? entry.timestamp ?? "");
  const note = String(entry.note ?? entry.reason ?? "");
  return { title, when, note };
}

function PhaseList({ phases }: { phases: GovernancePhase[] }) {
  return (
    <ol className="space-y-2">
      {phases.map((phase) => (
        <li
          key={phase.id}
          className="rounded-md border border-slate-200 bg-white px-3 py-2"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-semibold text-slate-900">{phase.label}</span>
            <Badge
              tone={
                phase.state === "rejected"
                  ? "high"
                  : phase.state === "current"
                    ? "info"
                    : phase.state === "complete"
                      ? "low"
                      : "neutral"
              }
              size="xs"
            >
              {phaseMark(phase.state)}
            </Badge>
          </div>
          <p className="mt-1 text-[12px] leading-snug text-slate-600">{phase.detail}</p>
        </li>
      ))}
    </ol>
  );
}

type Props = {
  open: boolean;
  row: QueueTableRow | null;
  evidence: EvidenceRecordDTO | null | undefined;
  actions: GovernedActionDTO[];
  scopeHref: (path: string) => string;
  onClose: () => void;
  onSendToActionCenter: () => void;
  sending?: boolean;
  onToast?: (message: string) => void;
  /** Open on the loop step this surface is already showing. */
  initialTab?: RiskDrawerTab;
};

export function RiskTriageDrawer({
  open,
  row,
  evidence,
  actions,
  scopeHref,
  onClose,
  onSendToActionCenter,
  sending = false,
  onToast,
  initialTab
}: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [tab, setTab] = useState<TabId>("summary");
  const [history, setHistory] = useState<SeverityHistoryItemDTO[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [deciding, setDeciding] = useState<"approve" | "reject" | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [actionPatch, setActionPatch] = useState<{
    status: string;
    verification_status: string;
  } | null>(null);
  const [localNotes, setLocalNotes] = useState<LocalNote[]>([]);
  const [historyTick, setHistoryTick] = useState(0);
  const [drawerWidth, setDrawerWidth] = useState(DRAWER_DEFAULT_WIDTH);
  const dragRef = useRef<{ x: number; width: number } | null>(null);

  const linkedAction = useMemo(
    () => (row ? findLinkedAction(actions, row) : null),
    [actions, row]
  );

  useEffect(() => {
    const next = initialTab === "code" ? "summary" : (initialTab ?? "summary");
    setTab(next);
    setDeciding(null);
    setVerifying(null);
    setActionPatch(null);
    setLocalNotes([]);
  }, [row?.incidentId, initialTab]);

  useEffect(() => {
    if (!actionPatch || !linkedAction) return;
    if (
      linkedAction.status === actionPatch.status &&
      linkedAction.verification_status === actionPatch.verification_status
    ) {
      setActionPatch(null);
    }
  }, [linkedAction, actionPatch]);

  useEffect(() => {
    if (!open) return;
    restoreFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const node = dialogRef.current;
    const closeButton = node?.querySelector<HTMLElement>("[data-drawer-close]");
    closeButton?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !node) return;
      const focusable = [
        ...node.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        )
      ].filter((el) => !el.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      restoreFocus.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open || !row) return;
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
  }, [open, row, historyTick]);

  if (!open || !row) return null;

  const action = linkedAction ? { ...linkedAction, ...(actionPatch ?? {}) } : null;
  const analysis = evidence?.fleetrac_analysis;
  const phases = governancePhases(action?.status, action?.verification_status);
  const uncertainty = uncertaintyFromConfidence(
    analysis?.assessment_confidence ?? analysis?.confidence ?? null
  );
  const investigation = codeInvestigationFromSignals(
    (evidence?.items ?? []).map((item) => item.evaluation_signals ?? null)
  );
  const ux = action
    ? resolveActionVerificationUx({
        status: action.status,
        rawVerificationStatus: action.verification_status,
        verificationStatus: action.verification_status,
        incidentId: action.alias_id ?? action.incident_id
      })
    : null;
  const nextStep = action
    ? riskDetailCta(action.status, action.verification_status)
    : "Review risk detail";
  const resolvedStep = resolveIncidentLifecycle({
    incidentId: row.incidentId,
    lifecycle: row.stage,
    severity: row.severityLabel,
    actionId: action?.id,
    actionStatus: action?.status,
    verificationStatus: action?.verification_status,
    resolutionStatus: action?.resolution_status,
    serverStage: action?.current_stage,
    serverLabel: action?.current_stage_label,
    serverStep: action?.next_required_step,
    serverCta: action?.primary_cta,
    serverDestination: action?.primary_destination,
    serverClosure: action?.closure_state,
    ownerTeam: row.ownerTeam ?? row.responderTeam,
    evidenceCount: evidence?.items?.length ?? row.evidenceItemsCount,
    ctaSurface: "risk_detail"
  });
  const evidenceHref = scopeHref(
    routeToEvidenceLibraryIncidentRecord(row.incidentId, row.ownerTeam)
  );
  const actionHref = action
    ? scopeHref(
        `${routes.actions()}?action=${encodeURIComponent(action.id)}&tab=${
          ux?.lane === "verification_result"
            ? "closed"
            : ux?.lane === "ready_to_verify"
              ? "ready"
              : "pending"
        }`
      )
    : scopeHref(routes.actions());
  const reviewer =
    action?.assigned_to ||
    evidence?.reviewer ||
    (row.assignedTo && row.assignedTo !== "—" ? row.assignedTo : "");
  const owner = row.responderTeam ?? row.ownerTeam;
  const recommended =
    analysis?.recommended_bounded_action ||
    analysis?.recommended_actions?.[0] ||
    row.recommendedAction;
  const evidenceCount = evidence?.items?.length ?? row.evidenceItemsCount ?? 0;
  const rollbackProposed =
    Boolean(action?.rollback_eligible) ||
    `${action?.status ?? ""} ${action?.verification_status ?? ""}`
      .toLowerCase()
      .includes("rollback");
  const demoHint = flagshipVerifyHint(row.incidentId);
  const lifecycle = (evidence?.lifecycle_history ?? []) as Record<string, unknown>[];
  const whatHappened = formatMetricBreach(row);

  const noteNow = () => new Date().toISOString();

  const decide = async (kind: "approve" | "reject") => {
    if (!action) return;
    setDeciding(kind);
    const result =
      kind === "approve"
        ? await postApproveAction(action.id)
        : await postRejectAction(action.id);
    setDeciding(null);
    if (!result) {
      onToast?.(`Could not ${kind} — check API connection`);
      return;
    }
    const status = result.status || (kind === "approve" ? "Approved" : "Rejected");
    const verification = kind === "approve" ? "Monitoring" : "Not started";
    setActionPatch({ status, verification_status: verification });
    setLocalNotes((prev) => [
      ...prev,
      {
        title: kind === "approve" ? "Remediation" : "Rejected",
        when: noteNow(),
        note: kind === "approve" ? "Governed action approved" : "Governed action rejected"
      }
    ]);
    setHistoryTick((tick) => tick + 1);
    setTab(kind === "approve" ? "verification" : "history");
    onToast?.(
      kind === "approve"
        ? "Approved. This records the decision and does not apply a change."
        : "Rejected. The decision is recorded and agent code was not changed."
    );
  };

  const verify = async (outcome: string, summary: string) => {
    if (!action) return;
    setVerifying(outcome);
    const result = await postVerifyAction(action.id, outcome, summary);
    setVerifying(null);
    if (!result || typeof result !== "object") {
      onToast?.("Could not record verification — check API connection");
      return;
    }
    const payload = result as { status?: string; verification_status?: string; outcome?: string };
    setActionPatch({
      status: payload.status || action.status,
      verification_status: payload.verification_status || outcome.replace(/_/g, " ")
    });
    setLocalNotes((prev) => [
      ...prev,
      {
        title: "Verification",
        when: noteNow(),
        note: `Verification: ${payload.outcome || outcome}`
      }
    ]);
    setHistoryTick((tick) => tick + 1);
    setTab("history");
    onToast?.("Verification recorded. Agent code was not changed.");
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/30"
        aria-label="Close risk triage"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-full max-w-[75vw] flex-col border-l border-slate-200 bg-white shadow-xl"
        style={{ width: clampDrawerWidth(drawerWidth) }}
      >
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize risk detail"
          aria-valuemin={Math.min(DRAWER_MIN_WIDTH, drawerMaxWidth())}
          aria-valuemax={drawerMaxWidth()}
          aria-valuenow={clampDrawerWidth(drawerWidth)}
          tabIndex={0}
          className="absolute inset-y-0 left-0 z-10 w-3 -translate-x-1/2 cursor-col-resize touch-none hover:bg-slate-400/20"
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            dragRef.current = { x: event.clientX, width: clampDrawerWidth(drawerWidth) };
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            if (!drag) return;
            setDrawerWidth(clampDrawerWidth(drag.width + (drag.x - event.clientX)));
          }}
          onPointerUp={() => {
            dragRef.current = null;
          }}
          onPointerCancel={() => {
            dragRef.current = null;
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              setDrawerWidth((current) => clampDrawerWidth(current + 32));
            } else if (event.key === "ArrowRight") {
              event.preventDefault();
              setDrawerWidth((current) => clampDrawerWidth(current - 32));
            }
          }}
        >
          <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-slate-300" aria-hidden />
        </div>
        <div className="shrink-0 border-b border-slate-100 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
                {row.incidentId} · Risk detail
              </p>
              <h2 id={titleId} className="mt-1 text-[22px] font-semibold leading-snug tracking-tight text-slate-950">
                {row.title}
              </h2>
              <p className="mt-1 text-[13px] text-slate-600">{row.systemName}</p>
            </div>
            <button
              type="button"
              data-drawer-close
              onClick={onClose}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
              aria-label="Close risk triage"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Badge tone={severityTone(row.severityLabel)} size="xs">
              {row.severityLabel}
            </Badge>
            <Badge tone="low" size="xs">Detected</Badge>
            <Badge tone={evidenceCount > 0 ? "low" : "neutral"} size="xs">
              {evidenceCount > 0 ? "Investigated" : "Investigation open"}
            </Badge>
            <Badge
              tone={
                !action
                  ? "neutral"
                  : ux?.awaitingDecision
                    ? "medium"
                    : ux?.resultKind === "rejected"
                      ? "high"
                      : "low"
              }
              size="xs"
            >
              {!action ? "Decision open" : ux?.awaitingDecision ? "Decision" : ux?.decisionLabel ?? "Decision"}
            </Badge>
            <Badge
              tone={ux?.canRecordVerification ? "info" : ux?.lane === "verification_result" ? "low" : "neutral"}
              size="xs"
            >
              {ux?.canRecordVerification
                ? "Verify"
                : ux?.lane === "verification_result"
                  ? ux.verificationLabel
                  : "Verification open"}
            </Badge>
          </div>
          <div className="mt-3">
            <NextRequiredStepCard
              lifecycle={resolvedStep}
              scopeHref={scopeHref}
              onPrimary={
                resolvedStep.primaryDestination.surface === "risk_detail"
                  ? () =>
                      setTab(
                        action
                          ? riskDetailCtaTab(action.status, action.verification_status)
                          : resolvedStep.currentStage === "CLOSED"
                            ? "history"
                            : "evidence"
                      )
                  : undefined
              }
              onSecondary={
                resolvedStep.secondaryDestination?.surface === "risk_detail"
                  ? () => setTab(resolvedStep.currentStage === "CLOSED" ? "history" : "evidence")
                  : undefined
              }
            />
          </div>
        </div>

        <div role="tablist" aria-label="Risk triage sections" className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-100 px-2">
          {TABS.map((item) => {
            const selected = tab === item.id;
            const codeLocked = item.id === "code";
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`risk-tab-${item.id}`}
                aria-selected={selected}
                aria-controls={`risk-panel-${item.id}`}
                aria-disabled={codeLocked}
                disabled={codeLocked}
                title={
                  codeLocked
                    ? "Source repository access is not connected. Code investigation is unavailable."
                    : undefined
                }
                tabIndex={selected && !codeLocked ? 0 : -1}
                onClick={() => {
                  if (codeLocked) return;
                  setTab(item.id);
                }}
                className={cn(
                  "shrink-0 border-b-2 px-2.5 py-2 text-[12px] font-medium",
                  codeLocked && "cursor-not-allowed border-transparent text-slate-300",
                  !codeLocked && selected && "border-emerald-700 text-slate-950",
                  !codeLocked && !selected && "border-transparent text-slate-500 hover:text-slate-800"
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {tab === "summary" ? (
            <div
              role="tabpanel"
              id="risk-panel-summary"
              aria-labelledby="risk-tab-summary"
              className="space-y-3"
            >
              <section>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  What happened
                </p>
                <p className="mt-1 text-[13px] font-medium leading-snug text-slate-900">
                  {whatHappened}
                </p>
                <p className="mt-1 text-[12px] leading-snug text-slate-600">
                  {impactExplanation(row.riskCategory)}
                </p>
                <p className="mt-1 text-[12px] leading-snug text-slate-600">
                  Owner: {owner}. Uncertainty: {uncertainty.uncertainty}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setTab(
                      action
                        ? riskDetailCtaTab(action.status, action.verification_status)
                        : "decision"
                    )
                  }
                  className="mt-3 inline-flex rounded-md bg-emerald-700 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-800"
                >
                  {nextStep} →
                </button>
                <p className="mt-1 text-[12px] text-slate-600">
                  {row.systemName}
                  <span className="text-slate-300"> · </span>
                  {row.riskCategory}
                  <span className="text-slate-300"> · </span>
                  {row.stage}
                </p>
              </section>
              <section className="grid grid-cols-2 gap-2 text-[12px]">
                <div className="rounded-md border border-slate-200 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Owner</p>
                  <p className="mt-1 font-medium text-slate-900">{owner}</p>
                </div>
                <div className="rounded-md border border-slate-200 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Evidence
                  </p>
                  <p className="mt-1 font-medium text-slate-900">
                    {evidenceCount} packaged
                  </p>
                </div>
                <div className="rounded-md border border-slate-200 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Confidence
                  </p>
                  <p className="mt-1 font-medium text-slate-900">{uncertainty.confidence}</p>
                  {uncertainty.confidence === "Low" ? (
                    <p className="mt-1 text-[11px] leading-snug text-slate-500">
                      {uncertainty.uncertainty}
                    </p>
                  ) : null}
                </div>
                <div className="rounded-md border border-slate-200 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Next step
                  </p>
                  <p className="mt-1 font-medium text-slate-900">{nextStep}</p>
                </div>
              </section>
              {analysis?.summary || row.evidenceSummary ? (
                uncertainty.confidence === "High" ||
                uncertainty.confidence === "Medium" ||
                uncertainty.confidence === "Low" ? (
                  <FleetracAnalysisPanel
                    compact
                    summary={analysis?.summary ?? (row.evidenceSummary || undefined)}
                    confidence={uncertainty.confidence}
                    recommendedAction={recommended}
                  />
                ) : (
                  <p className="text-[12px] leading-snug text-slate-700">
                    {analysis?.summary ?? row.evidenceSummary}
                  </p>
                )
              ) : (
                <p className="text-[12px] text-slate-500">No Fleetrac Analysis is packaged for this risk.</p>
              )}
              <PhaseList phases={phases} />
            </div>
          ) : null}

          {tab === "evidence" ? (
            <div
              role="tabpanel"
              id="risk-panel-evidence"
              aria-labelledby="risk-tab-evidence"
              className="space-y-3"
            >
              <PlainLanguageEvidence
                noticed={
                  analysis?.summary ||
                  evidence?.items?.[0]?.summary ||
                  row.evidenceSummary ||
                  "A control threshold was crossed on this agent."
                }
                whyItMatters={`${row.severityLabel || "This"} risk stays with ${row.ownerTeam || "the owner"} until someone records a decision.`}
                compared={row.evidenceSummary || null}
                snippet={(evidence?.items ?? [])
                  .slice(0, 6)
                  .map((item) => item.summary)}
                recommendation={recommended}
                raw={
                  evidence?.items?.[0]
                    ? JSON.stringify(evidence.items[0], null, 2)
                    : null
                }
              />
              <p className="text-[12px] leading-snug text-slate-700">
                {evidenceSupportSentence(evidenceCount)}
              </p>
              <Link
                href={evidenceHref}
                className="inline-flex rounded-md bg-emerald-700 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-800"
              >
                Open Evidence Library package
              </Link>
              {evidence?.items?.length ? (
                <ul className="space-y-2">
                  {evidence.items.map((item) => (
                    <li key={item.id} className="rounded-md border border-slate-200 px-3 py-2">
                      <p className="text-[12px] leading-snug text-slate-800">{item.summary}</p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {item.kind}
                        {item.operation_type ? ` · ${item.operation_type}` : ""}
                        {item.trace_id ? ` · trace ${item.trace_id.slice(0, 12)}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12px] text-slate-500">
                  No evidence items are packaged on this risk yet.
                </p>
              )}
              {analysis?.evidence_highlights?.length ? (
                <section>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Fleetrac Analysis highlights
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-[12px] text-slate-700">
                    {analysis.evidence_highlights.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          ) : null}

          {tab === "code" ? (
            <div
              role="tabpanel"
              id="risk-panel-code"
              aria-labelledby="risk-tab-code"
              className="space-y-3"
            >
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[12px] font-medium text-slate-900">Read-only investigation</p>
                <p className="mt-1 text-[12px] leading-snug text-slate-600">
                  This view cannot modify or deploy agent code. Findings appear only when a
                  file, line, or commit is already on the evidence record.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  tone={investigation.outcome === "candidate_cause" ? "medium" : "neutral"}
                  size="xs"
                >
                  {investigation.outcomeLabel}
                </Badge>
                <p className="text-[12px] text-slate-600">{investigation.detail}</p>
              </div>
              {investigation.cause ? (
                <p className="text-[13px] leading-snug text-slate-900">{investigation.cause}</p>
              ) : null}
              {investigation.citations.length ? (
                <ul className="space-y-2">
                  {investigation.citations.map((citation) => (
                    <li
                      key={`${citation.file}-${citation.line ?? ""}-${citation.commit ?? ""}`}
                      className="rounded-md border border-slate-200 px-3 py-2 font-mono text-[11px] text-slate-800"
                    >
                      <p>{citation.file}</p>
                      <p className="mt-1 text-slate-500">
                        {citation.line ? `line ${citation.line}` : "line not recorded"}
                        {" · "}
                        {citation.commit ? `commit ${citation.commit}` : "commit not recorded"}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12px] text-slate-600">
                  Source control is not connected. No file, line, or commit citation is available.
                </p>
              )}
              <section>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Runtime references
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  These are telemetry identifiers, not source citations.
                </p>
                {evidence?.items?.some((item) => item.trace_id || item.span_id) ? (
                  <ul className="mt-1 space-y-1 text-[12px] text-slate-700">
                    {evidence.items.slice(0, 6).map((item) => (
                      <li key={`${item.id}-ref`}>
                        {item.operation_type ?? item.kind}
                        {item.trace_id ? ` · trace ${item.trace_id.slice(0, 12)}` : ""}
                        {item.span_id ? ` · span ${item.span_id.slice(0, 8)}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-[12px] text-slate-500">No trace or span reference is packaged.</p>
                )}
              </section>
              <section className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Proposals
                </p>
                <div className="rounded-md border border-slate-200 px-3 py-2">
                  <p className="text-[12px] font-medium text-slate-900">Evidence-backed fix</p>
                  <p className="mt-1 text-[12px] leading-snug text-slate-600">
                    {evidenceCount > 0 && recommended
                      ? `${recommended} This is a proposal. It has not been applied.`
                      : recommended
                        ? "A recommendation exists, but it is not evidence-backed yet."
                        : "No fix is recorded for this risk."}
                  </p>
                </div>
                <div className="rounded-md border border-slate-200 px-3 py-2">
                  <p className="text-[12px] font-medium text-slate-900">Conditional rollback</p>
                  <p className="mt-1 text-[12px] leading-snug text-slate-600">
                    {rollbackProposed
                      ? "Verification marked a rollback candidate or the action is rollback-eligible. This is a proposal. Approving it does not roll back or deploy code."
                      : "No rollback proposal. Rollback is offered only when verification marks a rollback candidate or the action is rollback-eligible."}
                  </p>
                </div>
                <div className="rounded-md border border-slate-200 px-3 py-2">
                  <p className="text-[12px] font-medium text-slate-900">Escalation</p>
                  <p className="mt-1 text-[12px] leading-snug text-slate-600">
                    External paging is not connected. Inside Fleetrac this risk is with {owner}.
                  </p>
                </div>
              </section>
              {demoHint ? (
                <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] leading-snug text-slate-600">
                  <span className="font-medium text-slate-800">Demo guidance. </span>
                  {demoHint.story} This is not a code-investigation finding.
                </p>
              ) : null}
            </div>
          ) : null}

          {tab === "decision" ? (
            <div
              role="tabpanel"
              id="risk-panel-decision"
              aria-labelledby="risk-tab-decision"
              className="space-y-3"
            >
              <section>
                <p className="text-[14px] font-semibold text-slate-950">Human-controlled response</p>
                <p className="mt-1 text-[12px] leading-snug text-slate-600">
                  Fleetrac investigates and proposes. The owner implements an approved change outside Fleetrac. Approval does not apply, deploy, or change agent code.
                </p>
              </section>
              <section className="rounded-md border border-slate-200 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Reviewer
                </p>
                <p className="mt-1 text-[13px] font-medium text-slate-900">
                  {reviewer || "No reviewer recorded"}
                </p>
                <p className="mt-1 text-[12px] text-slate-600">
                  Changing the reviewer is not connected. The name above is the reviewer already on the risk or action record.
                </p>
              </section>
              <section className="rounded-md border border-slate-200 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Rationale
                </p>
                <p className="mt-1 text-[12px] leading-snug text-slate-800">
                  {analysis?.policy_notes || recommended || "No rationale is recorded on this risk."}
                </p>
                <p className="mt-1 text-[12px] text-slate-500">
                  Approve and reject do not store a separate free-text rationale.
                </p>
              </section>
              <section className="rounded-md border border-slate-200 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Evidence request
                </p>
                <p className="mt-1 text-[12px] leading-snug text-slate-600">
                  Requesting evidence from an external system is not connected. The packaged record is in the Evidence Library.
                </p>
                <Link
                  href={evidenceHref}
                  className="mt-2 inline-flex text-[12px] font-semibold text-slate-900 underline decoration-slate-300 underline-offset-2"
                >
                  Open Evidence Library package
                </Link>
              </section>
              <section className="rounded-md border border-slate-200 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Approval
                </p>
                <p className="mt-1 text-[12px] leading-snug text-slate-600">
                  Approving records a human decision. It does not apply, deploy, or change agent code.
                </p>
                {ux?.awaitingDecision && action ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={deciding !== null}
                      onClick={() => void decide("approve")}
                      className="rounded-md bg-emerald-700 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                    >
                      {deciding === "approve" ? "Approving…" : "Approve"}
                    </button>
                    <button
                      type="button"
                      disabled={deciding !== null}
                      onClick={() => void decide("reject")}
                      className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                    >
                      {deciding === "reject" ? "Rejecting…" : "Reject"}
                    </button>
                  </div>
                ) : (
                  <p className="mt-2 text-[12px] font-medium text-slate-800">
                    {action
                      ? `${action.status} · ${action.verification_status}`
                      : "No governed action yet. A generated risk opens one when it is detected."}
                  </p>
                )}
              </section>
              <section className="rounded-md border border-slate-200 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Engineering handoff
                </p>
                <p className="mt-1 text-[12px] leading-snug text-slate-600">
                  External ticket systems are not connected. Handoff here creates or opens the governed action for review. It does not change agent code.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {!action ? (
                    <button
                      type="button"
                      disabled={sending}
                      onClick={onSendToActionCenter}
                      className="rounded-md bg-emerald-700 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                    >
                      {sending ? "Handing off…" : "Hand off for review"}
                    </button>
                  ) : (
                    <Link
                      href={actionHref}
                      className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      Open in Action Center
                    </Link>
                  )}
                </div>
              </section>
            </div>
          ) : null}

          {tab === "verification" ? (
            <div
              role="tabpanel"
              id="risk-panel-verification"
              aria-labelledby="risk-tab-verification"
              className="space-y-3"
            >
              <p className="text-[14px] font-semibold text-slate-950">
                Implementation and outcome verification
              </p>
              <p className="text-[12px] leading-snug text-slate-600">
                Approval records a decision. Recording a verification outcome does not apply a fix, roll back, or change agent code.
              </p>
              <PhaseList phases={phases} />
              {ux?.canRecordVerification && action ? (
                <section className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Record outcome
                  </p>
                  {VERIFY_OUTCOMES.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={verifying !== null}
                      onClick={() => void verify(opt.id, opt.summary)}
                      className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50 disabled:opacity-60"
                    >
                      <span className="block text-[13px] font-semibold text-slate-950">
                        {verifying === opt.id ? "Recording…" : opt.label}
                      </span>
                      <span className="mt-0.5 block text-[12px] leading-snug text-slate-600">
                        {opt.summary}
                      </span>
                    </button>
                  ))}
                </section>
              ) : ux?.awaitingDecision ? (
                <button
                  type="button"
                  onClick={() => setTab("decision")}
                  className="inline-flex rounded-md bg-emerald-700 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-800"
                >
                  Review governed action →
                </button>
              ) : (
                <p className="text-[12px] leading-snug text-slate-600">
                  {action
                    ? `Recorded state: ${action.status} · ${action.verification_status}.`
                    : "Verification starts after detection opens a governed action."}
                </p>
              )}
              <p className="text-[12px] text-slate-600">Next step: {nextStep}</p>
            </div>
          ) : null}

          {tab === "history" ? (
            <div
              role="tabpanel"
              id="risk-panel-history"
              aria-labelledby="risk-tab-history"
              className="space-y-4"
            >
              <section>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Lifecycle
                </p>
                {lifecycle.length || localNotes.length ? (
                  <ol className="mt-2 space-y-2 border-l border-slate-200 pl-3">
                    {[
                      ...localNotes.filter(
                        (note) =>
                          !lifecycle.some((entry) => historyLabel(entry).note === note.note)
                      ),
                      ...lifecycle.map((entry) => historyLabel(entry))
                    ].map((item, index) => {
                      return (
                        <li key={`${item.title}-${item.when}-${index}`} className="text-[12px] text-slate-700">
                          <p className="font-medium text-slate-900">{item.title}</p>
                          {item.when ? <p className="text-[11px] text-slate-500">{item.when}</p> : null}
                          {item.note ? <p className="text-slate-600">{item.note}</p> : null}
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="mt-1 text-[12px] text-slate-500">No lifecycle history is on this evidence record.</p>
                )}
              </section>
              <section>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Severity
                </p>
                {historyLoading ? (
                  <p className="mt-1 text-[12px] text-slate-500">Loading severity history…</p>
                ) : history.length ? (
                  <ol className="mt-2 space-y-2 border-l border-slate-200 pl-3">
                    {history.map((item) => (
                      <li key={item.id} className="text-[12px] text-slate-700">
                        <p className="font-medium text-slate-900">
                          {item.previous_severity} → {item.new_severity}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {new Date(item.changed_at).toLocaleString()}
                        </p>
                        <p className="text-slate-600">{item.reason}</p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-1 text-[12px] text-slate-500">
                    No severity changes recorded
                    {row.highestSeverity ? `. Highest seen: ${row.highestSeverity}` : ""}.
                  </p>
                )}
              </section>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
