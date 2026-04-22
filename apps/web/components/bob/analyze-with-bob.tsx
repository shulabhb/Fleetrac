"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { BobIcon } from "./bob-icon";
import type { TargetType } from "@/lib/bob-types";

type AnalyzeWithBobProps = {
  targetType: TargetType;
  targetId: string;
  hasInvestigation?: boolean;
  label?: string;
  variant?: "inline" | "button" | "compact";
  className?: string;
};

/**
 * Subtle Bob entry point. Links to /bob/for/<type>/<id> which the Bob detail
 * page can resolve to an investigation. If `hasInvestigation` is true we
 * tighten the label (View Bob analysis) so the action reflects reality.
 */
export function AnalyzeWithBob({
  targetType,
  targetId,
  hasInvestigation,
  label,
  variant = "inline",
  className
}: AnalyzeWithBobProps) {
  const text =
    label ??
    (hasInvestigation
      ? "View Bob analysis"
      : targetType === "incident"
      ? "Analyze with Bob"
      : targetType === "control"
      ? "Analyze control"
      : "Analyze system");
  const href = `/bob/for/${targetType}/${targetId}`;

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
