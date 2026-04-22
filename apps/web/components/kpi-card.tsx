import type { ReactNode } from "react";
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
};

export function KpiCard({
  label,
  value,
  caption,
  tone = "neutral",
  tooltip,
  trailing,
  highlight
}: KpiCardProps) {
  const valueClass =
    tone === "urgent"
      ? "text-rose-700"
      : tone === "warning"
        ? "text-amber-700"
        : tone === "ok"
          ? "text-emerald-700"
          : "text-slate-900";

  return (
    <div
      className={cn(
        "relative flex flex-col justify-between overflow-hidden rounded-lg border bg-white p-4 shadow-card",
        highlight ? "border-slate-300" : "border-slate-200"
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
        </div>
      </div>
      <p className={cn("mt-2 text-3xl font-semibold tabular-nums tracking-tight", valueClass)}>
        {value}
      </p>
      {caption ? <p className="mt-1 text-xs text-slate-500">{caption}</p> : null}
    </div>
  );
}
