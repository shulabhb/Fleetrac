import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatInteger } from "@/lib/format";

type Accent = "indigo" | "slate" | "emerald" | "sky";

type StripProps = {
  accent?: Accent;
  icon: ReactNode;
  eyebrow: ReactNode;
  caption?: ReactNode;
  stats: ReactNode;
  cta?: { label: string; href: string };
  tone?: "default" | "tinted";
  /** Nest inside a parent shell: no outer border/radius, top divider only. */
  embedded?: boolean;
  /** Inline stats beside header vs full-width grid row below (clearer for many metrics). */
  layout?: "inline" | "stacked";
};

const accentClass: Record<Accent, string> = {
  indigo: "from-indigo-400 to-indigo-200",
  slate: "from-slate-400 to-slate-200",
  emerald: "from-emerald-400 to-sky-200",
  sky: "from-sky-400 to-sky-200"
};

const borderClass: Record<Accent, string> = {
  indigo: "border-indigo-100",
  slate: "border-slate-200",
  emerald: "border-slate-200",
  sky: "border-slate-200"
};

/**
 * Uniform dashboard control-plane strip used by Bob, Action Center, and Outcomes.
 * Gives the three strips a coherent Investigate → Act → Measure rhythm.
 */
export function DashboardStrip({
  accent = "slate",
  icon,
  eyebrow,
  caption,
  stats,
  cta,
  embedded = false,
  layout = "inline"
}: StripProps) {
  const stacked = layout === "stacked";
  return (
    <div
      className={cn(
        "relative flex gap-x-5 gap-y-2 bg-white px-4 py-3",
        embedded
          ? "rounded-none border-0 border-t border-slate-100 shadow-none"
          : cn("rounded-lg border shadow-card", borderClass[accent]),
        stacked ? "flex-col items-stretch" : "flex-wrap items-center"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute left-0 w-[3px] rounded-r bg-gradient-to-b",
          embedded ? "top-2 bottom-2" : "top-3 bottom-3",
          accentClass[accent]
        )}
      />
      <div
        className={cn(
          "flex min-w-0 items-center gap-2 pl-2",
          stacked && "w-full justify-between gap-3"
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-900 text-white">
            {icon}
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-700">
              {eyebrow}
            </p>
            {caption ? (
              <p className="line-clamp-2 text-[11px] text-slate-500 sm:truncate">
                {caption}
              </p>
            ) : null}
          </div>
        </div>
        {stacked && cta ? (
          <Link
            href={cta.href}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            {cta.label}
            <ArrowRight className="h-3 w-3" />
          </Link>
        ) : null}
      </div>

      <div
        className={cn(
          "flex flex-wrap items-center gap-x-4 gap-y-2 text-xs",
          stacked
            ? "w-full border-t border-slate-100 pt-2.5"
            : "ml-auto gap-x-5 gap-y-1.5"
        )}
      >
        {stats}
        {!stacked && cta ? (
          <Link
            href={cta.href}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            {cta.label}
            <ArrowRight className="h-3 w-3" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

type StatTone = "good" | "warn" | "urgent" | "info";

/**
 * A single strip stat: compact number + quiet label. The tone controls the
 * emphasis color only when `emphasize` is true (i.e. the value is non-zero
 * and worth drawing attention to). When `href` is provided, the stat becomes
 * a scoped drill-in link to the corresponding filtered view.
 */
export function StripStat({
  label,
  value,
  tone,
  emphasize,
  href
}: {
  label: string;
  value: number | string;
  tone?: StatTone;
  emphasize?: boolean;
  href?: string;
}) {
  const color =
    emphasize && tone === "urgent"
      ? "text-rose-700"
      : emphasize && tone === "warn"
        ? "text-amber-700"
        : emphasize && tone === "good"
          ? "text-emerald-700"
          : "text-slate-900";
  const body = (
    <>
      <span className={cn("text-sm font-semibold tabular-nums", color)}>
        {typeof value === "number" ? formatInteger(value) : value}
      </span>
      <span className="text-[11px] text-slate-500 group-hover:text-slate-700">
        {label}
      </span>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="group flex items-baseline gap-1.5 rounded-md px-1 py-0.5 transition hover:bg-slate-50"
      >
        {body}
      </Link>
    );
  }
  return <div className="flex items-baseline gap-1.5">{body}</div>;
}

/** Thin vertical separator between logical stat groups inside a strip. */
export function StripDivider() {
  return (
    <span
      aria-hidden
      className="hidden h-4 w-px bg-slate-200 sm:inline-block"
    />
  );
}
