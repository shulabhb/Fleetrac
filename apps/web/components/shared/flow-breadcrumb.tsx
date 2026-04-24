import Link from "next/link";
import {
  AlertTriangle,
  ChevronRight,
  LineChart,
  PlayCircle,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/cn";

type Step = {
  label: string;
  href?: string;
  icon?: "incident" | "bob" | "action" | "outcome";
  active?: boolean;
  missing?: boolean;
};

/**
 * A thin horizontal breadcrumb making the governed-remediation workflow
 * legible at the top of detail pages:
 *
 *   Incident → Bob investigation → Governed action → Measured outcome
 *
 * Steps that don't yet exist are dimmed; the active step is emphasized.
 * Intentionally calm — this is orientation, not navigation primary.
 */
export function FlowBreadcrumb({ steps }: { steps: Step[] }) {
  return (
    <nav
      aria-label="Governance flow"
      className="flex flex-wrap items-center gap-1 text-[11px] font-medium text-slate-500"
    >
      <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        Loop
      </span>
      {steps.map((s, i) => {
        const icon =
          s.icon === "incident" ? (
            <AlertTriangle className="h-3 w-3" />
          ) : s.icon === "bob" ? (
            <Sparkles className="h-3 w-3" />
          ) : s.icon === "action" ? (
            <PlayCircle className="h-3 w-3" />
          ) : s.icon === "outcome" ? (
            <LineChart className="h-3 w-3" />
          ) : null;
        const content = (
          <span
            title={stepTitle(s)}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition",
              s.active
                ? "bg-slate-900 text-white"
                : s.missing
                  ? "text-slate-300"
                  : s.href
                    ? "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    : "text-slate-500"
            )}
          >
            {icon}
            <span>{s.label}</span>
          </span>
        );
        return (
          <span key={i} className="inline-flex items-center gap-1">
            {s.href && !s.missing ? <Link href={s.href}>{content}</Link> : content}
            {i < steps.length - 1 ? (
              <ChevronRight className="h-3 w-3 text-slate-300" />
            ) : null}
          </span>
        );
      })}
    </nav>
  );
}

function stepTitle(step: Step): string {
  if (step.active) return `${step.label}: current surface`;
  if (step.missing) return `${step.label}: not available yet`;
  return `${step.label}: continue loop here`;
}
