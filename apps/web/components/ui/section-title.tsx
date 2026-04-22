import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type SectionTitleProps = {
  eyebrow?: string;
  title: ReactNode;
  caption?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function SectionTitle({ eyebrow, title, caption, actions, className }: SectionTitleProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="label-eyebrow">{eyebrow}</p> : null}
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 md:text-[22px]">{title}</h2>
        {caption ? <p className="mt-1 text-sm text-slate-500">{caption}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
