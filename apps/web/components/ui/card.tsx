import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  density?: "default" | "compact";
  interactive?: boolean;
};

export function Card({ className, density = "default", interactive, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200 bg-white shadow-card",
        density === "compact" ? "p-3" : "p-4",
        interactive &&
          "transition hover:border-slate-300 hover:shadow-card-hover focus-within:border-slate-400",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  caption,
  action,
  className
}: {
  title: ReactNode;
  caption?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold tracking-tight text-slate-900">{title}</h3>
        {caption ? <p className="mt-0.5 text-xs text-slate-500">{caption}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-1">{action}</div> : null}
    </div>
  );
}

export function CardSection({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-3", className)} {...props} />;
}
