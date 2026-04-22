import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "high" | "medium" | "low" | "info" | "outline";
  size?: "sm" | "xs";
  dot?: boolean;
};

const toneClasses: Record<string, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  high: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  medium: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  low: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  info: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  outline: "bg-white text-slate-600 ring-1 ring-slate-200"
};

const dotToneClasses: Record<string, string> = {
  neutral: "bg-slate-400",
  high: "bg-rose-500",
  medium: "bg-amber-500",
  low: "bg-emerald-500",
  info: "bg-sky-500",
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
        "inline-flex items-center gap-1.5 rounded-full font-medium",
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
