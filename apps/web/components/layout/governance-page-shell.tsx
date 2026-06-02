import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type GovernanceLoop =
  | "orient"
  | "observe"
  | "investigate"
  | "act"
  | "measure"
  | "configure"
  | "context";

const LOOP_LABEL: Record<GovernanceLoop, string> = {
  orient: "Orient",
  observe: "Observe",
  investigate: "Investigate",
  act: "Act",
  measure: "Measure",
  configure: "Configure",
  context: "Context"
};

type Props = {
  loop: GovernanceLoop;
  eyebrow: string;
  title: string;
  subtitle?: string;
  workflowLine?: string;
  summary?: ReactNode;
  headerAction?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function GovernancePageShell({
  loop,
  eyebrow,
  title,
  subtitle,
  workflowLine,
  summary,
  headerAction,
  children,
  className
}: Props) {
  return (
    <div className={cn("space-y-5", className)}>
      <header className="space-y-3 border-b border-slate-100 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {eyebrow}
              <span className="text-slate-300"> · </span>
              <span className="text-slate-400">{LOOP_LABEL[loop]}</span>
            </p>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
            {subtitle ? (
              <p className="text-[13px] text-slate-600">{subtitle}</p>
            ) : null}
            {workflowLine ? (
              <p className="text-[12px] text-slate-500">{workflowLine}</p>
            ) : null}
          </div>
          {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
        </div>
        {summary ? <div>{summary}</div> : null}
      </header>
      {children}
    </div>
  );
}
