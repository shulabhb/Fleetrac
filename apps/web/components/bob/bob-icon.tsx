import { Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

type BobIconProps = {
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  withBackground?: boolean;
};

const sizeMap = {
  xs: { wrap: "h-4 w-4", icon: "h-2.5 w-2.5" },
  sm: { wrap: "h-5 w-5", icon: "h-3 w-3" },
  md: { wrap: "h-7 w-7", icon: "h-4 w-4" },
  lg: { wrap: "h-9 w-9", icon: "h-5 w-5" }
};

export function BobIcon({ size = "sm", className, withBackground = true }: BobIconProps) {
  const s = sizeMap[size];
  if (!withBackground) {
    return <Sparkles className={cn(s.icon, "text-indigo-600", className)} aria-hidden />;
  }
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100",
        s.wrap,
        className
      )}
      aria-hidden
    >
      <Sparkles className={s.icon} />
    </span>
  );
}

export function BobEyebrow({ label = "Bob Analysis", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <BobIcon size="xs" />
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-indigo-700">
        {label}
      </span>
    </div>
  );
}
