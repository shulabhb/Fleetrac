"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { FleetracAnalysisPanel } from "@/components/fleetrac/fleetrac-analysis-panel";
import { ExecutionModeChip } from "@/components/fleetrac/execution-mode-chip";
import { postApproveAction, postRejectAction, postVerifyAction } from "@/lib/governance-api";
import {
  resolutionKindFromVerification,
  VerificationResolutionPanel
} from "@/components/actions/verification-resolution-panel";
import {
  canVerifyAction,
  type GovernedAction
} from "@/lib/governed-actions-types";
import {
  expectedImpactCopy,
  flagshipVerifyHint,
  resolveActionVerificationUx,
  verificationToneClass
} from "@/lib/action-verification-ux";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  routeToEvidenceLibraryIncidentRecord,
  routeToIncident
} from "@/lib/routes";
import { resolveIncidentLifecycle } from "@/lib/resolve-next-step";
import { NextRequiredStepCard } from "@/components/governance/next-required-step";

type Props = {
  action: GovernedAction | null;
  onDecision: () => void;
  onToast: (msg: string) => void;
};

const VERIFY_OUTCOMES = [
  {
    id: "improvement_observed",
    label: "Improvement observed",
    summary: "Post-approval telemetry moved in the expected direction."
  },
  {
    id: "no_material_change",
    label: "No material change",
    summary: "The metric did not move enough to close the risk. Follow-up is required."
  },
  {
    id: "regression_detected",
    label: "Follow-up required",
    summary: "The signal worsened after approval. Follow-up is required."
  },
  {
    id: "rollback_candidate",
    label: "Rollback candidate",
    summary: "Remediation may have increased blast radius — review rollback path."
  }
] as const;

export function ActionCenterDetailPanel({ action, onDecision, onToast }: Props) {
  if (!action) {
    return (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
        <p className="text-[13px] font-medium text-slate-800">Select a governed action</p>
        <p className="mt-1 max-w-[240px] text-[12px] leading-relaxed text-slate-600">
          Review the bounded recommendation, record an approval decision, then verify impact.
        </p>
      </div>
    );
  }

  const ux = resolveActionVerificationUx({
    status: action.status,
    verificationStatus: action.verificationStatus,
    rawVerificationStatus: action.rawVerificationStatus,
    incidentId: action.incidentId
  });
  const step = resolveIncidentLifecycle({
    incidentId: action.incidentId,
    actionId: action.id,
    actionStatus: action.status,
    verificationStatus: action.rawVerificationStatus || action.verificationStatus,
    resolutionStatus: action.resolutionStatus,
    serverStage: action.serverStage,
    serverLabel: action.serverLabel,
    serverStep: action.serverStep,
    serverCta: action.serverCta,
    serverDestination: action.serverDestination,
    serverClosure: action.serverClosure,
    severity: action.severity,
    ownerTeam: action.ownerTeam,
    outcome: action.rawVerificationStatus || action.verificationStatus,
    ctaSurface: "action_center"
  });
  const canDecide = ux.awaitingDecision;
  const showVerify = canVerifyAction(action);
  const resolutionKind = resolutionKindFromVerification(ux.resultKind);
  const showResolution = Boolean(resolutionKind) && !canDecide && !showVerify;
  const hint = flagshipVerifyHint(action.incidentId);
  const evidenceHref = routeToEvidenceLibraryIncidentRecord(
    action.incidentId,
    action.ownerTeam
  );

  const handleApprove = async () => {
    const result = await postApproveAction(action.id);
    if (!result) {
      onToast("Could not approve — check API connection");
      return;
    }
    onDecision();
    onToast("Approved · next step: verify impact against post-remediation telemetry");
  };

  const handleReject = async () => {
    const result = await postRejectAction(action.id);
    if (!result) {
      onToast("Could not reject — check API connection");
      return;
    }
    onDecision();
    onToast("Rejected · decision recorded for audit");
  };

  const handleVerify = async (outcome: string, summary: string) => {
    const result = await postVerifyAction(action.id, outcome, summary);
    if (!result) {
      onToast("Could not record verification — check API connection");
      return;
    }
    onDecision();
    onToast(`Verification recorded · ${outcome.replace(/_/g, " ")}`);
  };

  return (
    <div className="flex h-full min-h-[280px] flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
      {/* Hero */}
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center rounded-none px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              verificationToneClass(ux.tone)
            )}
          >
            {ux.decisionLabel}
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded-none px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              verificationToneClass(
                ux.resultKind === "improved"
                  ? "emerald"
                  : ux.resultKind === "rollback"
                    ? "rose"
                    : ux.lane === "ready_to_verify"
                      ? "indigo"
                      : "slate"
              )
            )}
          >
            {ux.verificationLabel}
          </span>
          <ExecutionModeChip mode={action.executionMode} />
        </div>
        <h3 className="mt-2 text-sm font-semibold leading-snug text-slate-900">
          {action.incidentTitle}
        </h3>
        <p className="mt-0.5 text-[11px] text-slate-600">
          <span className="font-mono text-slate-500">{action.incidentId}</span>
          {action.systemName ? (
            <>
              <span className="text-slate-300"> · </span>
              <span>{action.systemName}</span>
            </>
          ) : null}
        </p>
        <div className="mt-2">
          <NextRequiredStepCard
            lifecycle={step}
            compact
            hideActions={showResolution}
          />
        </div>
        <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
          Decision → Verification → Evidence
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {/* Decision checkpoint */}
        <CheckpointCard
          step="1"
          title="Decision"
          state={
            canDecide
              ? "Awaiting human approval"
              : ux.resultKind === "rejected"
                ? "Rejected"
                : ux.resultKind === "policy_blocked"
                  ? "Policy-blocked"
                  : "Approved · audit-linked"
          }
          tone={canDecide ? "amber" : ux.resultKind === "rejected" ? "slate" : "emerald"}
        >
          <p className="text-[12px] leading-relaxed text-slate-700">
            {action.recommendedAction ||
              "Bounded, policy-checked remediation awaiting a governance decision."}
          </p>
          {canDecide ? (
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleApprove()}
                className="inline-flex flex-1 items-center justify-center rounded-md bg-slate-900 px-3 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                Approve governed action
              </button>
              <button
                type="button"
                onClick={() => void handleReject()}
                className="inline-flex flex-1 items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-800 shadow-sm transition hover:border-slate-300"
              >
                Block / reject
              </button>
            </div>
          ) : (
            <dl className="mt-2 grid gap-1 text-[11px] text-slate-600">
              <Row label="Status" value={action.status} />
              {action.approver ? <Row label="Approver" value={action.approver} /> : null}
              {action.decidedAt ? (
                <Row
                  label="Decided"
                  value={formatRelativeTime(action.decidedAt)}
                />
              ) : null}
            </dl>
          )}
        </CheckpointCard>

        {/* Verification checkpoint */}
        <CheckpointCard
          step="2"
          title="Verification"
          state={ux.verificationLabel}
          tone={
            ux.resultKind === "improved"
              ? "emerald"
              : ux.resultKind === "rollback"
                ? "rose"
                : showVerify
                  ? "indigo"
                  : "slate"
          }
        >
          {canDecide || ux.resultKind === "rejected" || ux.resultKind === "policy_blocked" ? (
            <p className="text-[12px] leading-relaxed text-slate-600">
              Verification starts after approval or execution.
            </p>
          ) : (
            <div className="space-y-2 text-[12px] text-slate-700">
              <p>
                <span className="font-medium text-slate-800">Expected impact: </span>
                {expectedImpactCopy(action.incidentId)}
              </p>
              <p>
                <span className="font-medium text-slate-800">Monitoring window: </span>
                Post-approval telemetry until a verification outcome is recorded.
              </p>
              <p>
                <span className="font-medium text-slate-800">Current result: </span>
                {action.rawVerificationStatus || ux.verificationLabel}
              </p>
              {hint ? (
                <p className="rounded-md border border-slate-100 bg-slate-50/80 px-2.5 py-1.5 text-[11px] text-slate-600">
                  <span className="font-medium text-slate-700">Flagship path · </span>
                  {hint.story}
                </p>
              ) : null}
              {ux.resultKind === "rollback" ? (
                <p className="rounded-md border border-rose-100 bg-rose-50/60 px-2.5 py-1.5 text-[11px] text-rose-800">
                  Rollback recommended — review the reversible path before expanding scope.
                </p>
              ) : null}
            </div>
          )}

          {showVerify ? (
            <div className="mt-2.5 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Record verification outcome
              </p>
              <div className="grid gap-1.5">
                {VERIFY_OUTCOMES.map((opt) => {
                  const preferred = hint?.preferredOutcome === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => void handleVerify(opt.id, opt.summary)}
                      className={cn(
                        "rounded-md border px-3 py-2 text-left text-[11px] font-medium transition",
                        preferred
                          ? "border-slate-800 bg-slate-900 text-white hover:bg-slate-800"
                          : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                      )}
                    >
                      {opt.label}
                      {preferred ? (
                        <span className="mt-0.5 block text-[10px] font-normal opacity-80">
                          Suggested for this flagship scenario
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {showResolution && resolutionKind ? (
            <div className="mt-2.5">
              <VerificationResolutionPanel
                action={action}
                kind={resolutionKind}
                onRecorded={onDecision}
                onToast={onToast}
              />
            </div>
          ) : !canDecide && !showVerify ? (
            <Link
              href={evidenceHref}
              className="mt-2.5 inline-flex text-[12px] font-semibold text-slate-800 underline decoration-slate-300 underline-offset-2 hover:text-slate-600"
            >
              View outcome evidence
            </Link>
          ) : null}
        </CheckpointCard>

        {/* Evidence / analysis */}
        <CheckpointCard step="3" title="Evidence" state="Audit-linked" tone="slate">
          <FleetracAnalysisPanel
            incidentId={action.incidentId}
            summary={action.fleetracAnalysisSummary}
            recommendedAction={action.recommendedAction}
            compact
          />
          <dl className="mt-2 grid gap-1 text-[11px] text-slate-600">
            {action.systemName ? <Row label="Affected agent" value={action.systemName} /> : null}
            <Row label="Owner team" value={action.ownerTeam} />
            <Row label="Queued" value={action.createdAtLabel} />
          </dl>
        </CheckpointCard>
      </div>

      <div className="space-y-2 border-t border-slate-100 px-4 py-3">
        <Link
          href={evidenceHref}
          className="block text-center text-[12px] font-semibold text-slate-800 underline decoration-slate-300 underline-offset-2 hover:text-slate-600"
        >
          View outcome evidence →
        </Link>
        <Link
          href={routeToIncident(action.incidentId)}
          className="block text-center text-[12px] font-medium text-slate-500 hover:text-slate-800"
        >
          Open Risk Detail (history)
        </Link>
        <p className="text-[10px] leading-snug text-slate-400">
          Bounded actions are approval-gated, policy-checked, audit-linked, and reversible where
          supported. Fleetrac does not stop at approval — verify whether the action worked.
        </p>
      </div>
    </div>
  );
}

function CheckpointCard({
  step,
  title,
  state,
  tone,
  children
}: {
  step: string;
  title: string;
  state: string;
  tone: "amber" | "indigo" | "emerald" | "rose" | "slate";
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          <span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-100 text-[9px] font-bold text-slate-600">
            {step}
          </span>
          {title}
        </p>
        <Badge
          tone="outline"
          size="xs"
          className={cn("font-medium", verificationToneClass(tone))}
        >
          {state}
        </Badge>
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{value}</dd>
    </div>
  );
}
