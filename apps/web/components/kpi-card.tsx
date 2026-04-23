import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { InfoTooltip } from "@/components/ui/info-tooltip";

type KpiCardProps = {
  label: string;
  value: ReactNode;
  caption?: ReactNode;
  tone?: "neutral" | "urgent" | "warning" | "ok";
  tooltip?: ReactNode;
  trailing?: ReactNode;
  highlight?: boolean;
  href?: string;
};

export function KpiCard({
  label,
  value,
  caption,
  tone = "neutral",
  tooltip,
  trailing,
  highlight,
  href
}: KpiCardProps) {
  const valueClass =
    tone === "urgent"
      ? "text-rose-700"
      : tone === "warning"
        ? "text-amber-700"
        : tone === "ok"
          ? "text-emerald-700"
          : "text-slate-900";

  const container = (
    <div
      className={cn(
        "group relative flex h-full flex-col justify-between overflow-hidden rounded-lg border bg-white p-4 shadow-card transition",
        highlight ? "border-slate-300" : "border-slate-200",
        href ? "hover:border-slate-300 hover:shadow-sm" : ""
      )}
    >
      {highlight ? (
        <span
          aria-hidden
          className={cn(
            "absolute left-0 top-0 h-full w-0.5",
            tone === "urgent"
              ? "bg-rose-500"
              : tone === "warning"
                ? "bg-amber-500"
                : tone === "ok"
                  ? "bg-emerald-500"
                  : "bg-slate-400"
          )}
        />
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <p className="label-eyebrow">{label}</p>
        <div className="flex items-center gap-1">
          {trailing}
          {tooltip ? <InfoTooltip content={tooltip} /> : null}
          {href ? (
            <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 transition group-hover:text-slate-600" />
          ) : null}
        </div>
      </div>
      <p
        className={cn(
          "mt-2 text-3xl font-semibold tabular-nums tracking-tight",
          valueClass
        )}
      >
        {value}
      </p>
      {caption ? (
        <p className="mt-1 text-[11px] text-slate-500">{caption}</p>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 rounded-lg"
      >
        {container}
      </Link>
    );
  }
  return container;
}
