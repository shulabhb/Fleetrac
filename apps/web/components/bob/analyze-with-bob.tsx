"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { BobIcon } from "./bob-icon";
import type { TargetType } from "@/lib/bob-types";
import {
  routeToBobForTarget,
  routeToBobInvestigation,
  type BobTargetType
} from "@/lib/routes";

type AnalyzeWithBobProps = {
  targetType: TargetType;
  targetId: string;
  /**
   * When the caller has already resolved the investigation id, pass it so the
   * link bypasses the `/bob/for/<type>/<id>` resolver and lands directly on
   * the Bob investigation detail. One hop, no redirect, no chance of a
   * transient "missing" fallback.
   */
  investigationId?: string | null;
  hasInvestigation?: boolean;
  label?: string;
  variant?: "inline" | "button" | "compact";
  className?: string;
};

/**
 * Subtle Bob entry point. If `investigationId` is provided we link directly
 * to the investigation. Otherwise we fall back to the resolver, which either
 * redirects to the exact investigation or surfaces a clear "no review" banner
 * on the Bob list.
 */
export function AnalyzeWithBob({
  targetType,
  targetId,
  investigationId,
  hasInvestigation,
  label,
  variant = "inline",
  className
}: AnalyzeWithBobProps) {
  const resolved = Boolean(investigationId) || Boolean(hasInvestigation);
  const text =
    label ??
    (resolved
      ? "Open Bob investigation"
      : targetType === "incident"
      ? "Start Bob investigation"
      : targetType === "control"
      ? "Analyze control"
      : "Review Bob analysis");
  const href = investigationId
    ? routeToBobInvestigation(investigationId)
    : routeToBobForTarget(targetType as BobTargetType, targetId);

  if (variant === "button") {
    return (
      <Link
        href={href}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-medium text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-50",
          className
        )}
      >
        <BobIcon size="xs" withBackground={false} />
        {text}
      </Link>
    );
  }

  if (variant === "compact") {
    return (
      <Link
        href={href}
        onClick={(e) => e.stopPropagation()}
        aria-label={text}
        title={text}
        className={cn(
          "inline-flex h-6 w-6 items-center justify-center rounded-md text-indigo-500 transition hover:bg-indigo-50 hover:text-indigo-700",
          className
        )}
      >
        <BobIcon size="xs" withBackground={false} />
      </Link>
    );
  }

  return (
    <Link
      href={href}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 transition hover:text-indigo-800 hover:underline decoration-indigo-300 underline-offset-2",
        className
      )}
    >
      <BobIcon size="xs" withBackground={false} />
      {text}
    </Link>
  );
}
