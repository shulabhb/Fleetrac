import Link from "next/link";
import { AlertTriangle, ArrowRight, ShieldOff } from "lucide-react";
import type { Action } from "@/lib/action-types";
import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/format";
import {
  ActionTypeChip,
  ApprovalStateBadge,
  BlastRadiusBadge,
  ExecutionStateBadge,
  MonitoringBadge,
  ReversibleBadge,
  RiskBadge
} from "./index";

/**
 * Compact, rich card that represents a single governed action. Used in the
 * Action Center list view and in "linked actions" strips on other surfaces.
 * Cards are dense enough that a dedicated detail page is optional for
 * low-risk items, but still carry enough context to be useful standalone.
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
  const href = detailHref ?? `/actions/${action.id}`;
  const risk = action.risk_level;
  return (
    <div
      className={cn(
        "relative rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-300",
        risk === "high" && "border-l-[3px] border-l-rose-300",
        risk === "medium" && "border-l-[3px] border-l-amber-300",
        risk === "low" && "border-l-[3px] border-l-slate-200",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <ActionTypeChip type={action.action_type} />
            <RiskBadge risk={risk} />
            <ExecutionStateBadge state={action.execution_status} />
            <ApprovalStateBadge state={action.approval_status} />
            {!action.allowed_by_policy ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 ring-1 ring-rose-200">
                <ShieldOff className="h-3 w-3" />
                Policy block
              </span>
            ) : null}
            <MonitoringBadge status={action.monitoring_status} />
          </div>
          <h4 className="mt-1.5 text-sm font-semibold tracking-tight text-slate-900">
            {action.title}
          </h4>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600">
            {action.prepared_change_summary}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
            {action.target_system_name ? (
              <span>
                <span className="text-slate-400">System:</span>{" "}
                <span className="font-medium text-slate-700">
                  {action.target_system_name}
                </span>
              </span>
            ) : null}
            <span>
              <span className="text-slate-400">Approver:</span>{" "}
              <span className="font-medium text-slate-700">
                {action.required_approver}
              </span>
            </span>
            <span>
              <span className="text-slate-400">Owner:</span>{" "}
              <span className="font-medium text-slate-700">
                {action.recommended_owner}
              </span>
            </span>
            <ReversibleBadge reversible={action.reversible} />
            <BlastRadiusBadge radius={action.blast_radius} />
          </div>
          {action.blocked_reason ? (
            <div className="mt-2 flex items-start gap-1.5 rounded-md border border-rose-100 bg-rose-50/60 px-2.5 py-1.5 text-[11px] text-rose-700">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{action.blocked_reason}</span>
            </div>
          ) : null}
          {action.rejection_reason ? (
            <div className="mt-2 rounded-md border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 text-[11px] text-slate-600">
              <span className="text-slate-400">Rejected:</span>{" "}
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
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px]">
        <div className="flex items-center gap-3 text-slate-500">
          {action.bob_investigation_id ? (
            <Link
              href={`/bob/${action.bob_investigation_id}`}
              className="text-slate-500 hover:text-slate-900 hover:underline"
            >
              Bob investigation →
            </Link>
          ) : null}
          {action.related_incident_id ? (
            <Link
              href={`/incidents/${action.related_incident_id}`}
              className="text-slate-500 hover:text-slate-900 hover:underline"
            >
              Incident →
            </Link>
          ) : null}
          {action.related_control_id ? (
            <Link
              href={`/controls?q=${encodeURIComponent(action.related_control_id)}`}
              className="text-slate-500 hover:text-slate-900 hover:underline"
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

/**
 * Slim single-line row for embedding in system / incident / Bob surfaces
 * where full cards would be too heavy.
 */
export function ActionMiniRow({ action }: { action: Action }) {
  return (
    <Link
      href={`/actions/${action.id}`}
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
