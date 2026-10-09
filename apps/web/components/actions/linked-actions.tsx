import Link from "next/link";
import { ArrowRight, PlayCircle } from "lucide-react";
import type { Action } from "@/lib/action-types";
import { ActionMiniRow } from "./action-card";

/**
 * Compact sidecar listing governed actions tied to a system / risk.
 * Uses Phase D Action Center lanes:
 * Awaiting decision · Ready to verify · Verification results.
 */
export function LinkedActionsPanel({
  actions,
  title = "Governed actions",
  caption,
  emptyLabel = "No governed actions yet. Bounded remediations appear here with approval and verification state.",
  viewAllHref = "/actions",
  rollbackActionIds
}: {
  actions: Action[];
  title?: string;
  caption?: string;
  emptyLabel?: string;
  viewAllHref?: string;
  rollbackActionIds?: Set<string>;
}) {
  const awaitingCount = actions.filter(
    (a) =>
      a.execution_status === "awaiting_approval" ||
      a.execution_status === "drafted" ||
      a.execution_status === "prepared"
  ).length;
  const readyCount = actions.filter(
    (a) =>
      a.execution_status === "ready_to_execute" ||
      a.execution_status === "approved" ||
      a.execution_status === "executed" ||
      a.execution_status === "monitoring_outcome"
  ).length;
  const rollbackCount = rollbackActionIds
    ? actions.filter((a) => rollbackActionIds.has(a.id)).length
    : actions.filter(
        (a) =>
          a.monitoring_status === "rollback_recommended" ||
          a.execution_status === "follow_up_required"
      ).length;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-none">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="label-eyebrow flex items-center gap-1.5">
            <PlayCircle className="h-3.5 w-3.5 text-slate-500" />
            {title}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {caption ??
              "Approve bounded actions, then verify impact. Approval-gated, policy-checked, audit-linked."}
          </p>
        </div>
        <Link
          href={viewAllHref}
          className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900"
        >
          Action Center
          <ArrowRight className="h-3 w-3" />
        </Link>
      </header>

      {actions.length === 0 ? (
        <p className="mt-3 rounded-md border border-dashed border-slate-200 bg-slate-50/60 p-3 text-[11px] leading-relaxed text-slate-500">
          {emptyLabel}
        </p>
      ) : (
        <>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
            <Count label="awaiting decision" value={awaitingCount} warn={awaitingCount > 0} />
            <Count label="ready to verify" value={readyCount} />
            {rollbackCount > 0 ? (
              <Pill label="Rollback candidates" value={rollbackCount} tone="urgent" />
            ) : null}
          </div>
          <div className="mt-3 space-y-1.5">
            {actions.slice(0, 5).map((a) => (
              <ActionMiniRow key={a.id} action={a} />
            ))}
            {actions.length > 5 ? (
              <p className="text-[11px] text-slate-500">
                + {actions.length - 5} more in Action Center
              </p>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}

function Pill({
  label,
  value,
  tone = "default"
}: {
  label: string;
  value: number;
  tone?: "default" | "warn" | "urgent";
}) {
  const cls =
    tone === "urgent"
      ? "bg-rose-50 text-rose-700 ring-rose-200"
      : tone === "warn"
        ? "bg-amber-50 text-amber-800 ring-amber-200"
        : "bg-slate-100 text-slate-700 ring-slate-200";
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ring-1 " +
        cls
      }
    >
      <span className="tabular-nums">{value}</span>
      <span>{label}</span>
    </span>
  );
}

function Count({
  label,
  value,
  warn
}: {
  label: string;
  value: number;
  warn?: boolean;
}) {
  return (
    <span>
      <span
        className={
          "font-semibold tabular-nums " + (warn ? "text-amber-700" : "text-slate-700")
        }
      >
        {value}
      </span>{" "}
      {label}
    </span>
  );
}
