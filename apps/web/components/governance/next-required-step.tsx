"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import type { ResolvedIncidentLifecycle } from "@/lib/resolve-next-step";

const URGENCY_BAR: Record<ResolvedIncidentLifecycle["urgency"], string> = {
  critical: "bg-red-300",
  high: "bg-orange-400",
  medium: "bg-amber-200",
  low: "bg-emerald-600",
  neutral: "bg-slate-300"
};

function StepButton({
  href,
  label,
  primary,
  onClick
}: {
  href?: string;
  label: string;
  primary?: boolean;
  onClick?: () => void;
}) {
  const className = cn(
    "inline-flex items-center rounded-md px-3 py-1.5 text-[12px] font-semibold",
    primary
      ? "bg-slate-900 text-white hover:bg-slate-800"
      : "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {label}
      </button>
    );
  }
  if (href) {
    return (
      <Link href={href} className={className}>
        {label}
      </Link>
    );
  }
  return null;
}

export function NextRequiredStepCard({
  lifecycle,
  scopeHref,
  onPrimary,
  onSecondary,
  compact = false,
  hideActions = false
}: {
  lifecycle: ResolvedIncidentLifecycle;
  scopeHref?: (path: string) => string;
  onPrimary?: () => void;
  onSecondary?: () => void;
  compact?: boolean;
  hideActions?: boolean;
}) {
  const href = (path: string) => (scopeHref ? scopeHref(path) : path);
  const closeReady = lifecycle.canClose && lifecycle.closureState === "close_ready";
  const stillOpen =
    lifecycle.closureState === "open_rollback" || lifecycle.closureState === "open_follow_up";
  return (
    <div
      className={cn(
        "flex gap-3 rounded-md border border-slate-200 bg-slate-50/80",
        compact ? "px-3 py-2" : "px-3 py-2.5"
      )}
    >
      <span
        className={cn("mt-0.5 h-8 w-0.5 shrink-0 rounded-full", URGENCY_BAR[lifecycle.urgency])}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {lifecycle.currentStageLabel}
          </p>
          {closeReady ? (
            <span className="rounded-sm bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
              Close-ready
            </span>
          ) : null}
          {stillOpen ? (
            <span className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
              Stays open
            </span>
          ) : null}
          {lifecycle.closureState === "closed" ? (
            <span className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
              Closed
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Next required step
        </p>
        <p className="mt-0.5 text-[13px] font-semibold text-slate-950">
          {lifecycle.nextRequiredStep}
        </p>
        <p className="mt-0.5 text-[12px] leading-snug text-slate-600">
          {lifecycle.nextStepExplanation}
        </p>
        {hideActions ? null : (
        <div className="mt-2 flex flex-wrap gap-2">
          <StepButton
            label={lifecycle.primaryCtaLabel}
            primary
            href={onPrimary ? undefined : href(lifecycle.primaryDestination.href)}
            onClick={onPrimary}
          />
          {lifecycle.secondaryCtaLabel && lifecycle.secondaryDestination ? (
            <StepButton
              label={lifecycle.secondaryCtaLabel}
              href={onSecondary ? undefined : href(lifecycle.secondaryDestination.href)}
              onClick={onSecondary}
            />
          ) : null}
        </div>
        )}
      </div>
    </div>
  );
}
