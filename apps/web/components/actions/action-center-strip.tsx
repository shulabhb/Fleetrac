import Link from "next/link";
import { ArrowRight, PlayCircle } from "lucide-react";
import type { Action } from "@/lib/action-types";
import { formatInteger } from "@/lib/format";

/**
 * Dashboard strip that surfaces governed remediation load: pending approvals,
 * actions ready to execute, actions being monitored, and regression signals.
 * Intentionally reuses the visual language of the Bob strip.
 */
export function ActionCenterStrip({ actions }: { actions: Action[] }) {
  const pending = actions.filter(
    (a) =>
      a.execution_status === "awaiting_approval" ||
      a.execution_status === "drafted" ||
      a.execution_status === "prepared"
  ).length;
  const ready = actions.filter(
    (a) =>
      a.execution_status === "ready_to_execute" ||
      a.execution_status === "approved"
  ).length;
  const monitoring = actions.filter(
    (a) =>
      a.execution_status === "monitoring_outcome" ||
      a.execution_status === "follow_up_required"
  ).length;
  const regression = actions.filter(
    (a) =>
      a.monitoring_status === "regression_detected" ||
      a.monitoring_status === "rollback_recommended"
  ).length;
  const highRiskPending = actions.filter(
    (a) =>
      a.risk_level === "high" &&
      (a.execution_status === "awaiting_approval" ||
        a.execution_status === "drafted" ||
        a.execution_status === "prepared")
  ).length;

  return (
    <div className="relative flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3">
      <span
        aria-hidden
        className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r bg-gradient-to-b from-slate-400 to-slate-200"
      />
      <div className="flex items-center gap-2 pl-2">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-slate-900/90 text-white">
          <PlayCircle className="h-3 w-3" />
        </span>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
            Action Center · Governed Remediation
          </p>
          <p className="text-xs text-slate-600">
            Approval-gated actions derived from Bob recommendations, with
            approver, policy and execution boundary attached.
          </p>
        </div>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-4 text-xs">
        <StripStat
          label="Pending approval"
          value={pending}
          emphasize={pending > 0}
          tone="warn"
        />
        <StripStat
          label="High-risk pending"
          value={highRiskPending}
          emphasize={highRiskPending > 0}
          tone="urgent"
        />
        <StripStat label="Ready to execute" value={ready} />
        <StripStat label="Monitoring outcome" value={monitoring} />
        <StripStat
          label="Regression / rollback"
          value={regression}
          emphasize={regression > 0}
          tone="urgent"
        />
        <Link
          href="/actions"
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          Open Action Center
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

function StripStat({
  label,
  value,
  emphasize,
  tone
}: {
  label: string;
  value: number;
  emphasize?: boolean;
  tone?: "warn" | "urgent";
}) {
  const color = emphasize
    ? tone === "urgent"
      ? "text-rose-700"
      : "text-amber-700"
    : "text-slate-900";
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`text-sm font-semibold tabular-nums ${color}`}>
        {formatInteger(value)}
      </span>
      <span className="text-[11px] text-slate-500">{label}</span>
    </div>
  );
}
