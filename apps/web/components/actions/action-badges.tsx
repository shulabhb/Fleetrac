import { cn } from "@/lib/cn";
import type {
  ApprovalState,
  BlastRadius,
  BobOperatingMode,
  ExecutionMode,
  ExecutionState,
  MonitoringStatus,
  RiskLevel
} from "@/lib/action-types";

// --- Execution lifecycle ---------------------------------------------------

const EXEC_CFG: Record<
  ExecutionState,
  { label: string; className: string }
> = {
  drafted: {
    label: "Drafted",
    className: "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
  },
  awaiting_approval: {
    label: "Awaiting approval",
    className: "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
  },
  approved: {
    label: "Approved",
    className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
  },
  rejected: {
    label: "Rejected",
    className: "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
  },
  prepared: {
    label: "Prepared",
    className: "bg-sky-50 text-sky-700 ring-1 ring-sky-200"
  },
  ready_to_execute: {
    label: "Approved · ready",
    className: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
  },
  executed: {
    label: "Executed",
    className: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
  },
  monitoring_outcome: {
    label: "Monitoring outcome",
    className: "bg-violet-50 text-violet-700 ring-1 ring-violet-200"
  },
  closed: {
    label: "Closed",
    className: "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
  },
  reverted: {
    label: "Reverted",
    className: "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
  },
  follow_up_required: {
    label: "Follow-up required",
    className: "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
  }
};

export function ExecutionStateBadge({
  state,
  className
}: {
  state: ExecutionState;
  className?: string;
}) {
  const c = EXEC_CFG[state];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        c.className,
        className
      )}
    >
      {c.label}
    </span>
  );
}

export function executionStateLabel(state: ExecutionState): string {
  return EXEC_CFG[state].label;
}

// --- Approval --------------------------------------------------------------

const APPROVAL_CFG: Record<
  ApprovalState,
  { label: string; className: string }
> = {
  not_required: {
    label: "No approval required",
    className: "bg-slate-50 text-slate-600 ring-1 ring-slate-200"
  },
  pending: {
    label: "Awaiting approval",
    className: "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
  },
  approved: {
    label: "Approved",
    className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
  },
  rejected: {
    label: "Rejected",
    className: "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
  },
  escalated: {
    label: "Policy-escalated",
    className: "bg-orange-50 text-orange-800 ring-1 ring-orange-200"
  }
};

export function ApprovalStateBadge({
  state,
  className
}: {
  state: ApprovalState;
  className?: string;
}) {
  const c = APPROVAL_CFG[state];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        c.className,
        className
      )}
    >
      {c.label}
    </span>
  );
}

// --- Risk -----------------------------------------------------------------

const RISK_CFG: Record<RiskLevel, { label: string; className: string }> = {
  low: {
    label: "Low risk",
    className: "bg-slate-100 text-slate-700 ring-1 ring-slate-200"
  },
  medium: {
    label: "Medium risk",
    className: "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
  },
  high: {
    label: "High risk",
    className: "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
  }
};

export function RiskBadge({
  risk,
  className
}: {
  risk: RiskLevel;
  className?: string;
}) {
  const c = RISK_CFG[risk];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        c.className,
        className
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          risk === "high"
            ? "bg-rose-500"
            : risk === "medium"
              ? "bg-amber-500"
              : "bg-slate-400"
        )}
      />
      {c.label}
    </span>
  );
}

// --- Blast radius ---------------------------------------------------------

const BLAST_LABELS: Record<BlastRadius, string> = {
  single_system: "Single system",
  workflow_slice: "Workflow slice",
  system_fleet: "Fleet-wide",
  non_customer_facing: "Non-customer-facing",
  staging_only: "Staging only",
  reversible_only: "Reversible only"
};

export function BlastRadiusBadge({ radius }: { radius: BlastRadius }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
      <svg
        aria-hidden
        viewBox="0 0 12 12"
        className="h-2.5 w-2.5"
        fill="currentColor"
      >
        <circle cx="6" cy="6" r="5" opacity="0.25" />
        <circle cx="6" cy="6" r="2" />
      </svg>
      Blast radius: {BLAST_LABELS[radius]}
    </span>
  );
}

// --- Reversible -----------------------------------------------------------

export function ReversibleBadge({ reversible }: { reversible: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        reversible
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
          : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
      )}
    >
      {reversible ? "Reversible" : "Not reversible"}
    </span>
  );
}

// --- Execution mode -------------------------------------------------------

const EXEC_MODE_LABELS: Record<ExecutionMode, string> = {
  manual_handoff: "Manual handoff",
  bob_prepares: "Bob prepares",
  approval_gated: "Approval-gated execution",
  auto_within_bounds: "Auto within bounds"
};

export function ExecutionModeChip({ mode }: { mode: ExecutionMode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 ring-1 ring-indigo-100">
      {EXEC_MODE_LABELS[mode]}
    </span>
  );
}

// --- Monitoring status ----------------------------------------------------

const MON_CFG: Record<MonitoringStatus, { label: string; className: string }> = {
  not_applicable: {
    label: "Monitoring n/a",
    className: "bg-slate-50 text-slate-500 ring-1 ring-slate-200"
  },
  monitoring_next_window: {
    label: "Under monitoring",
    className: "bg-violet-50 text-violet-700 ring-1 ring-violet-200"
  },
  awaiting_telemetry: {
    label: "Awaiting telemetry",
    className: "bg-sky-50 text-sky-700 ring-1 ring-sky-200"
  },
  no_meaningful_change: {
    label: "No material change",
    className: "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
  },
  improvement_observed: {
    label: "Improvement observed",
    className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
  },
  regression_detected: {
    label: "Regression detected",
    className: "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
  },
  rollback_recommended: {
    label: "Rollback recommended",
    className: "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
  },
  reviewer_signoff_pending: {
    label: "Reviewer sign-off pending",
    className: "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
  }
};

export function MonitoringBadge({
  status,
  className
}: {
  status: MonitoringStatus;
  className?: string;
}) {
  const c = MON_CFG[status];
  if (status === "not_applicable") return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        c.className,
        className
      )}
    >
      {c.label}
    </span>
  );
}

// --- Bob operating mode ---------------------------------------------------

const BOB_MODE_CFG: Record<
  BobOperatingMode,
  { label: string; className: string }
> = {
  observe_only: {
    label: "Observe only",
    className: "bg-slate-100 text-slate-700 ring-1 ring-slate-200"
  },
  recommend_only: {
    label: "Recommend only",
    className: "bg-slate-100 text-slate-700 ring-1 ring-slate-200"
  },
  prepare_actions: {
    label: "Prepare actions",
    className: "bg-sky-50 text-sky-700 ring-1 ring-sky-200"
  },
  approval_gated_execution: {
    label: "Approval-gated execution",
    className: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
  },
  limited_auto_execution: {
    label: "Limited auto-execution",
    className: "bg-violet-50 text-violet-700 ring-1 ring-violet-200"
  }
};

export function BobOperatingModeBadge({
  mode,
  className
}: {
  mode: BobOperatingMode;
  className?: string;
}) {
  const c = BOB_MODE_CFG[mode];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        c.className,
        className
      )}
    >
      Bob: {c.label}
    </span>
  );
}

export function bobOperatingModeLabel(mode: BobOperatingMode): string {
  return BOB_MODE_CFG[mode].label;
}

// --- Helpers for humanizing action types ----------------------------------

const ACTION_TYPE_LABELS: Record<string, string> = {
  open_ticket: "Open ticket",
  create_followup_review: "Follow-up review",
  assign_owner: "Assign owner",
  draft_runbook: "Draft runbook",
  request_review: "Request review",
  schedule_monitoring_window: "Monitoring window",
  prepare_threshold_change: "Prepare threshold change",
  prepare_control_split: "Prepare control split",
  prepare_config_suggestion: "Prepare config change",
  prepare_routing_change: "Prepare routing change",
  prepare_review_gate_tightening: "Tighten review gate",
  prepare_fallback_activation: "Activate fallback",
  request_rollback: "Request rollback",
  request_workflow_pause: "Request workflow pause",
  request_traffic_reroute: "Request traffic reroute",
  request_model_disablement: "Request model disablement",
  request_emergency_review_path: "Emergency review path",
  prepare_auto_remediation_candidate: "Auto-remediation candidate"
};

export function actionTypeLabel(type: string): string {
  return ACTION_TYPE_LABELS[type] ?? type.replace(/_/g, " ");
}
