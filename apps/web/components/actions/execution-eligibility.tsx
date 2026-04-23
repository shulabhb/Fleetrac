import Link from "next/link";
import { CheckCircle2, Lock, ShieldAlert } from "lucide-react";
import type { Action } from "@/lib/action-types";
import { BobOperatingModeBadge, ExecutionModeChip } from "./index";
import type { BobOperatingMode } from "@/lib/action-types";
import { routeToAction } from "@/lib/routes";

type Props = {
  action: Action;
  bobOperatingMode?: BobOperatingMode | null;
  className?: string;
};

/**
 * Makes Bob's authority on a single action explicit. Shown in Bob
 * investigation detail, Incident Bob section, System Bob analysis, and
 * Action Center action detail.
 */
export function ExecutionEligibilityCard({
  action,
  bobOperatingMode,
  className
}: Props) {
  const eligible = action.allowed_by_policy;
  const requiresApproval = action.approval_status !== "not_required";
  return (
    <div
      className={
        "rounded-lg border border-slate-200 bg-white p-4 " + (className ?? "")
      }
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="label-eyebrow">Execution eligibility</p>
          <h4 className="mt-0.5 text-sm font-semibold text-slate-900">
            What Bob can do on this action
          </h4>
        </div>
        {bobOperatingMode ? (
          <BobOperatingModeBadge mode={bobOperatingMode} />
        ) : null}
      </div>

      <ul className="mt-3 space-y-2 text-xs text-slate-700">
        <Row
          label="Policy check"
          value={eligible ? "Allowed" : "Blocked"}
          tone={eligible ? "ok" : "warn"}
          icon={
            eligible ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
            )
          }
        />
        <Row
          label="Approval required"
          value={requiresApproval ? "Yes" : "No"}
          tone="ok"
          icon={<Lock className="h-3.5 w-3.5 text-slate-500" />}
        />
        <Row
          label="Approver"
          value={action.required_approver}
          icon={<span className="h-3.5 w-3.5" />}
        />
        <Row
          label="Approval policy"
          value={action.approval_policy}
          icon={<span className="h-3.5 w-3.5" />}
        />
        <Row
          label="Execution mode"
          value={<ExecutionModeChip mode={action.execution_mode} />}
          icon={<span className="h-3.5 w-3.5" />}
        />
        {!eligible && action.blocked_reason ? (
          <Row
            label="Blocked by policy"
            value={action.blocked_reason}
            tone="warn"
            icon={<ShieldAlert className="h-3.5 w-3.5 text-rose-600" />}
          />
        ) : null}
      </ul>

      {action.execution_notes ? (
        <p className="mt-3 rounded-md border border-slate-200 bg-slate-50/70 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
          {action.execution_notes}
        </p>
      ) : null}

      <div className="mt-3 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
        <Link
          href={routeToAction(action.id)}
          className="font-medium text-slate-600 hover:text-slate-900 hover:underline"
        >
          Open action detail →
        </Link>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
  icon
}: {
  label: string;
  value: React.ReactNode;
  tone?: "ok" | "warn";
  icon?: React.ReactNode;
}) {
  return (
    <li className="flex items-start justify-between gap-3">
      <span className="flex shrink-0 items-center gap-1.5 text-[11px] uppercase tracking-wide text-slate-400">
        {icon}
        {label}
      </span>
      <span
        className={
          "min-w-0 text-right text-xs font-medium " +
          (tone === "warn"
            ? "text-rose-700"
            : tone === "ok"
              ? "text-emerald-700"
              : "text-slate-700")
        }
      >
        {value}
      </span>
    </li>
  );
}
