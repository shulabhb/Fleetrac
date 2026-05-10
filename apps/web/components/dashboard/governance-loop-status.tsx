import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import type { GovernanceLoopStage } from "@/lib/governance-dashboard-mock";

const STAGES: { key: GovernanceLoopStage; label: string }[] = [
  { key: "signal", label: "Signal" },
  { key: "packaged", label: "Packaged" },
  { key: "review", label: "Review" },
  { key: "action", label: "Action" },
  { key: "verified", label: "Verified" }
];

function stageIndex(stage: GovernanceLoopStage): number {
  return STAGES.findIndex((s) => s.key === stage);
}

export function GovernanceLoopStatus({
  currentStage,
  stageSummary,
  variant = "system",
  deliveryLine,
  compact = false
}: {
  currentStage: GovernanceLoopStage;
  stageSummary: string;
  variant?: "owner" | "system";
  /** Shown under bottleneck copy (owner mode): evidence delivery handoff. */
  deliveryLine?: string;
  /** Dense inline pipeline for owner dashboard panel (reduces vertical height). */
  compact?: boolean;
}) {
  const cur = stageIndex(currentStage);
  const supportingLine =
    variant === "owner" ? `Current bottleneck: ${stageSummary}` : stageSummary;

  if (compact && variant === "owner") {
    const inlinePipeline = STAGES.map((stage, i) => {
      let mark = "○";
      if (cur >= 0 && i < cur) mark = "✓";
      else if (cur >= 0 && i === cur) mark = "●";
      return `${stage.label} ${mark}`;
    }).join(" → ");

    return (
      <div className="rounded border border-slate-100 bg-slate-50/50 px-2 py-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Governance loop
        </p>
        <p className="mt-1 text-[10px] leading-snug text-slate-600">{inlinePipeline}</p>
        <p className="mt-1 text-[11px] leading-snug text-slate-500">{stageSummary}</p>
        {deliveryLine ? (
          <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
            <span className="text-slate-400">Delivery:</span> {deliveryLine}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-slate-100 bg-slate-50/60 px-2 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Governance loop
      </p>
      <p className="mt-1 text-[10px] leading-snug text-slate-400">
        Signal → Packaged → Review → Action → Verified
      </p>
      {variant === "owner" ? (
        <p className="mt-1 text-[9px] leading-snug text-slate-400">
          Evidence generated and owner notified.
        </p>
      ) : null}

      <div className="mt-2 flex w-full items-start justify-between px-0.5">
        {STAGES.map((stage, i) => {
          const complete = cur >= 0 && i < cur;
          const current = cur >= 0 && i === cur;
          const pending = cur >= 0 && i > cur;

          return (
            <div key={stage.key} className="flex min-w-0 flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <div
                  className={cn("h-px flex-1 bg-slate-200", i === 0 && "opacity-0")}
                  aria-hidden
                />
                <div className="mx-0.5 flex h-5 shrink-0 items-center justify-center">
                  {complete ? (
                    <Check className="h-3 w-3 shrink-0 text-emerald-700" strokeWidth={2.5} aria-hidden />
                  ) : current ? (
                    <span
                      className="block h-2 w-2 shrink-0 rounded-full bg-slate-900 ring-2 ring-slate-900 ring-offset-1 ring-offset-white"
                      aria-hidden
                    />
                  ) : (
                    <span
                      className={cn(
                        "block h-2 w-2 shrink-0 rounded-full border border-slate-300 bg-white",
                        pending && "opacity-90"
                      )}
                      aria-hidden
                    />
                  )}
                </div>
                <div
                  className={cn(
                    "h-px flex-1 bg-slate-200",
                    i === STAGES.length - 1 && "opacity-0"
                  )}
                  aria-hidden
                />
              </div>
              <span
                className={cn(
                  "mt-1 max-w-[56px] text-center text-[9px] leading-tight",
                  current ? "font-semibold text-slate-800" : "text-slate-500"
                )}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-[11px] leading-snug text-slate-500">{supportingLine}</p>
      {deliveryLine ? (
        <p className="mt-1 text-[11px] leading-snug text-slate-500">
          <span className="text-slate-400">Delivery:</span> {deliveryLine}
        </p>
      ) : null}
    </div>
  );
}
