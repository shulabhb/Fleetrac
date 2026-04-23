import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import type { Action, ExecutionState } from "@/lib/action-types";
import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/format";
import {
  routeToAction,
  routeToBobInvestigation,
  routeToControl,
  routeToIncident
} from "@/lib/routes";
import {
  ActionTypeChip,
  ApprovalStateBadge,
  ExecutionStateBadge,
  MonitoringBadge,
  RiskBadge
} from "./index";
import { SafetyBar } from "./safety-bar";

type PhaseTone = "prepare" | "decision" | "approved" | "executed" | "blocked" | "closed";

/**
 * The governed action card. Built around four horizontal bands:
 *   1. phase accent + status pills
 *   2. title + what it does if approved
 *   3. ownership row (system / approver / owner)
 *   4. safety bar (approval-gated / reversible / bounded / policy-checked)
 * Footer: related links + "Open action" CTA.
 */
export function ActionCard({
  action,
  detailHref,
  className
}: {
  action: Action;
  detailHref?: string;
  className?: string;
}) {
  const href = detailHref ?? routeToAction(action.id);
  const phase = executionPhase(action.execution_status, action.allowed_by_policy);
  const ifApproved = describeIfApproved(action);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-300",
        phaseAccentClass(phase),
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-0 h-full w-[3px]",
          phaseAccentBar(phase)
        )}
      />

      <div className="flex items-start justify-between gap-3 pl-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <ActionTypeChip type={action.action_type} />
            <PhaseBadge phase={phase} state={action.execution_status} />
            <RiskBadge risk={action.risk_level} />
            <ApprovalStateBadge state={action.approval_status} />
            <MonitoringBadge status={action.monitoring_status} />
          </div>

          <h4 className="mt-2 text-sm font-semibold tracking-tight text-slate-900">
            {action.title}
          </h4>

          {ifApproved ? (
            <p className="mt-1 text-[12px] leading-relaxed text-slate-600">
              <span className="text-slate-400">If approved: </span>
              {ifApproved}
            </p>
          ) : null}

          {action.prepared_change_summary &&
          action.prepared_change_summary !== ifApproved ? (
            <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-slate-500">
              {action.prepared_change_summary}
            </p>
          ) : null}

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
            {action.target_system_name ? (
              <MetaPair label="System" value={action.target_system_name} />
            ) : null}
            <MetaPair label="Approver" value={action.required_approver} />
            <MetaPair label="Owner" value={action.recommended_owner} />
          </div>

          <div className="mt-2.5">
            <SafetyBar
              approvalGated={action.approval_status !== "not_required"}
              policyAllowed={action.allowed_by_policy}
              reversible={action.reversible}
              blastRadius={action.blast_radius}
              riskLevel={action.risk_level}
              density="compact"
            />
          </div>

          {action.blocked_reason ? (
            <div className="mt-2 flex items-start gap-1.5 rounded-md border border-rose-100 bg-rose-50/60 px-2.5 py-1.5 text-[11px] text-rose-700">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>
                <span className="font-semibold">Policy block · </span>
                {action.blocked_reason}
              </span>
            </div>
          ) : null}
          {action.rejection_reason ? (
            <div className="mt-2 rounded-md border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 text-[11px] text-slate-600">
              <span className="text-slate-400">Rejected · </span>
              {action.rejection_reason}
            </div>
          ) : null}
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">
            Updated
          </p>
          <p className="text-xs font-medium tabular-nums text-slate-700">
            {formatRelativeTime(action.updated_at)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 pl-1.5 text-[11px]">
        <div className="flex items-center gap-3 text-slate-500">
          {action.bob_investigation_id ? (
            <Link
              href={routeToBobInvestigation(action.bob_investigation_id)}
              className="hover:text-slate-900 hover:underline"
            >
              Bob investigation →
            </Link>
          ) : null}
          {action.related_incident_id ? (
            <Link
              href={routeToIncident(action.related_incident_id)}
              className="hover:text-slate-900 hover:underline"
            >
              Incident →
            </Link>
          ) : null}
          {action.related_control_id ? (
            <Link
              href={routeToControl(action.related_control_id)}
              className="hover:text-slate-900 hover:underline"
            >
              Control →
            </Link>
          ) : null}
        </div>
        <Link
          href={href}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
        >
          Open action
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

// ---- Helpers --------------------------------------------------------------

function executionPhase(state: ExecutionState, allowed: boolean): PhaseTone {
  if (!allowed) return "blocked";
  if (state === "drafted" || state === "prepared" || state === "awaiting_approval")
    return "prepare";
  if (state === "approved" || state === "ready_to_execute") return "approved";
  if (
    state === "executed" ||
    state === "monitoring_outcome" ||
    state === "follow_up_required"
  )
    return "executed";
  if (state === "closed" || state === "rejected" || state === "reverted")
    return "closed";
  return "decision";
}

function phaseAccentBar(phase: PhaseTone): string {
  switch (phase) {
    case "prepare":
      return "bg-amber-400";
    case "decision":
      return "bg-sky-400";
    case "approved":
      return "bg-indigo-400";
    case "executed":
      return "bg-slate-800";
    case "blocked":
      return "bg-rose-500";
    case "closed":
      return "bg-slate-300";
  }
}

function phaseAccentClass(phase: PhaseTone): string {
  switch (phase) {
    case "blocked":
      return "border-l border-l-rose-100";
    default:
      return "";
  }
}

function PhaseBadge({
  phase,
  state
}: {
  phase: PhaseTone;
  state: ExecutionState;
}) {
  // Prefer the canonical ExecutionStateBadge, but add a compact phase tag up
  // front so the scanner instantly knows where in the lifecycle this sits.
  const label =
    phase === "prepare"
      ? "Prepared"
      : phase === "approved"
        ? "Approved"
        : phase === "executed"
          ? "Executed"
          : phase === "blocked"
            ? "Blocked"
            : phase === "closed"
              ? "Closed"
              : null;
  if (!label) return <ExecutionStateBadge state={state} />;
  const cls =
    phase === "prepare"
      ? "bg-amber-50 text-amber-800 ring-amber-200"
      : phase === "approved"
        ? "bg-indigo-50 text-indigo-700 ring-indigo-200"
        : phase === "executed"
          ? "bg-slate-900 text-white ring-slate-900"
          : phase === "blocked"
            ? "bg-rose-50 text-rose-700 ring-rose-200"
            : "bg-slate-100 text-slate-600 ring-slate-200";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ring-1",
        cls
      )}
    >
      {label}
    </span>
  );
}

function MetaPair({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-700">{value}</span>
    </span>
  );
}

function describeIfApproved(action: Action): string {
  // Prefer the scope or prepared summary if it reads as a concrete intent.
  if (
    action.action_scope &&
    action.action_scope.length > 0 &&
    action.action_scope.length <= 140
  )
    return action.action_scope;
  return action.prepared_change_summary;
}

/**
 * Slim single-line row for embedding in system / incident / Bob surfaces
 * where full cards would be too heavy.
 */
export function ActionMiniRow({ action }: { action: Action }) {
  return (
    <Link
      href={routeToAction(action.id)}
      className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] transition hover:border-slate-300"
    >
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-slate-800">
          {action.title}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <RiskBadge risk={action.risk_level} />
          <ExecutionStateBadge state={action.execution_status} />
          <MonitoringBadge status={action.monitoring_status} />
        </div>
      </div>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
    </Link>
  );
}
