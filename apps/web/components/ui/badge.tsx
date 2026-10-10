import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "critical" | "high" | "medium" | "low" | "info" | "outline";
  size?: "sm" | "xs";
  dot?: boolean;
};

const toneClasses: Record<string, string> = {
  neutral: "bg-slate-200 text-slate-800",
  critical: "bg-red-100 text-red-800",
  high: "bg-orange-700 text-white",
  medium: "bg-amber-100 text-amber-900",
  low: "bg-emerald-700 text-white",
  info: "bg-sky-800 text-white",
  outline: "bg-white text-slate-700 ring-1 ring-slate-300"
};

const dotToneClasses: Record<string, string> = {
  neutral: "bg-slate-400",
  critical: "bg-red-400",
  high: "bg-orange-600",
  medium: "bg-amber-300",
  low: "bg-emerald-600",
  info: "bg-sky-700",
  outline: "bg-slate-400"
};

export function Badge({
  className,
  tone = "neutral",
  size = "sm",
  dot = false,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-none font-semibold uppercase tracking-wide",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-1.5 py-0.5 text-[10px]",
        toneClasses[tone],
        className
      )}
      {...rest}
    >
      {dot ? <span className={cn("h-1.5 w-1.5 rounded-full", dotToneClasses[tone])} /> : null}
      {children}
    </span>
  );
}
