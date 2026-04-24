import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

type DisclosureSectionProps = {
  title: ReactNode;
  eyebrow?: ReactNode;
  summary?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  bodyClassName?: string;
};

export function DisclosureSection({
  title,
  eyebrow,
  summary,
  children,
  defaultOpen = false,
  className,
  bodyClassName
}: DisclosureSectionProps) {
  return (
    <details
      open={defaultOpen}
      className={cn(
        "group rounded-lg border border-slate-200 bg-white shadow-none",
        className
      )}
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-4 py-3 marker:hidden">
        <div className="min-w-0">
          {eyebrow ? <p className="label-eyebrow">{eyebrow}</p> : null}
          <h3 className="text-sm font-semibold tracking-tight text-slate-900">
            {title}
          </h3>
          {summary ? (
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              {summary}
            </p>
          ) : null}
        </div>
        <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition group-open:rotate-180">
          <ChevronDown className="h-3.5 w-3.5" />
        </span>
      </summary>
      <div className={cn("border-t border-slate-100 p-4", bodyClassName)}>
        {children}
      </div>
    </details>
  );
}
