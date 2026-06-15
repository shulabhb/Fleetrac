"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { FleetracAnalysisPanel } from "@/components/fleetrac/fleetrac-analysis-panel";
import { ExecutionModeChip } from "@/components/fleetrac/execution-mode-chip";
import { postApproveAction, postRejectAction, postVerifyAction } from "@/lib/governance-api";
import {
  canVerifyAction,
  type GovernedAction
} from "@/lib/governed-actions-types";
import { formatRelativeTime } from "@/lib/format";
import {
  routeToEvidenceLibraryIncidentRecord,
  routeToIncidentsOwnerQueue
} from "@/lib/routes";

type Props = {
  action: GovernedAction | null;
  onDecision: () => void;
  onToast: (msg: string) => void;
};

const VERIFY_OUTCOMES = [
  {
    id: "improvement_observed",
    label: "Improvement observed",
    summary: "Post-remediation telemetry shows reduced signal recurrence."
  },
  {
    id: "no_material_change",
    label: "No material change",
    summary: "Metrics unchanged in the verification window."
  },
  {
    id: "regression_detected",
    label: "Regression detected",
    summary: "Signal worsened after remediation — follow-up required."
  },
  {
    id: "rollback_candidate",
    label: "Rollback candidate",
    summary: "Remediation may have increased blast radius."
  }
] as const;

export function ActionCenterDetailPanel({ action, onDecision, onToast }: Props) {
  if (!action) {
    return (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
        <p className="text-[13px] font-medium text-slate-800">Select an action</p>
        <p className="mt-1 max-w-[240px] text-[12px] leading-relaxed text-slate-600">
          Choose a governed item from the inbox to review the recommendation and record a
          governance decision.
        </p>
      </div>
    );
  }

  const canDecide = action.status === "Awaiting approval";
  const showVerify = canVerifyAction(action);

  const handleApprove = async () => {
    const result = await postApproveAction(action.id);
    if (!result) {
      onToast("Could not approve — check API connection");
      return;
    }
    onDecision();
    onToast(
      "Approved · Fleetrac will notify Slack channel #ai-governance when execution completes"
    );
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
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="outline" size="xs" className="font-semibold uppercase tracking-wide">
            From {action.source}
          </Badge>
          <ExecutionModeChip mode={action.executionMode} />
          <Badge tone="info" size="xs">
            {action.status}
          </Badge>
        </div>
        <h3 className="mt-2 text-sm font-semibold leading-snug text-slate-900">
          {action.incidentTitle}
        </h3>
        <p className="mt-0.5 font-mono text-[11px] text-slate-500">{action.incidentId}</p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        <FleetracAnalysisPanel
          incidentId={action.incidentId}
          summary={action.fleetracAnalysisSummary}
          recommendedAction={action.recommendedAction}
          compact
        />

        {action.recommendedAction ? (
          <div className="rounded-md border border-slate-100 bg-slate-50/60 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Recommended action
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-800">
              {action.recommendedAction}
            </p>
          </div>
        ) : null}

        <dl className="grid gap-2 text-[11px] text-slate-600">
          {action.systemName ? <Row label="System" value={action.systemName} /> : null}
          <Row label="Owner team" value={action.ownerTeam} />
          {action.assignedTo ? <Row label="Assigned to" value={action.assignedTo} /> : null}
          {action.slackNotifiedAt ? (
            <Row label="Slack notified" value={action.slackNotifiedAt} />
          ) : null}
          {action.approver ? <Row label="Approver" value={action.approver} /> : null}
          <Row label="Verification" value={action.verificationStatus} />
          <Row label="Queued" value={action.createdAtLabel} />
          {action.decidedAt ? (
            <Row label="Decided" value={formatRelativeTime(new Date(action.decidedAt))} />
          ) : null}
        </dl>
      </div>

      <div className="space-y-2 border-t border-slate-100 px-4 py-3">
        {canDecide ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleApprove()}
              className="inline-flex flex-1 items-center justify-center rounded-md bg-slate-900 px-3 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => void handleReject()}
              className="inline-flex flex-1 items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-800 shadow-sm transition hover:border-slate-300"
            >
              Reject
            </button>
          </div>
        ) : null}

        {showVerify ? (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Record verification outcome
            </p>
            <div className="grid gap-1.5">
              {VERIFY_OUTCOMES.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => void handleVerify(opt.id, opt.summary)}
                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-[11px] font-medium text-slate-800 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <Link
          href={routeToEvidenceLibraryIncidentRecord(action.incidentId, action.ownerTeam)}
          className="block text-center text-[12px] font-semibold text-slate-800 underline decoration-slate-300 underline-offset-2 hover:text-slate-600"
        >
          Open evidence record →
        </Link>
        <Link
          href={routeToIncidentsOwnerQueue(action.ownerTeam, action.incidentId)}
          className="block text-center text-[12px] font-medium text-slate-600 hover:text-slate-900"
        >
          Back to Incident Queue
        </Link>
        <p className="text-[10px] leading-snug text-slate-400">
          Fleetrac recommendations are approval-gated, policy-checked, and audit-linked.
          Measure post-execution impact in Evidence Library.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-800">{value}</dd>
    </div>
  );
}
