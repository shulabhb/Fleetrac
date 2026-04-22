import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { humanizeLabel } from "@/lib/present";
import { cn } from "@/lib/cn";
import { AnalyzeWithBob } from "@/components/bob/analyze-with-bob";

type SystemCardProps = {
  system: any;
  openCount: number;
  highestSeverity?: "high" | "medium" | "low" | null;
  topIssueTitle?: string | null;
  href?: string;
  compact?: boolean;
};

function postureTone(posture: string): "high" | "medium" | "low" | "neutral" | "info" {
  if (posture === "critical") return "high";
  if (posture === "at_risk") return "high";
  if (posture === "watch") return "medium";
  if (posture === "healthy") return "low";
  return "neutral";
}

function severityTone(sev: string | null | undefined): "high" | "medium" | "low" | "neutral" {
  if (sev === "high") return "high";
  if (sev === "medium") return "medium";
  if (sev === "low") return "low";
  return "neutral";
}

export function SystemCard({
  system,
  openCount,
  highestSeverity,
  topIssueTitle,
  href,
  compact
}: SystemCardProps) {
  const target = href ?? `/systems/${system.id}`;
  const displayName = system.use_case
    ? `${system.use_case} (${system.model})`
    : system.name ?? system.id;

  return (
    <div
      className={cn(
        "group relative rounded-lg border border-slate-200 bg-white p-3 transition",
        "hover:border-slate-300 hover:shadow-card-hover focus-within:border-slate-400"
      )}
    >
      <Link
        href={target}
        aria-label={`Open ${displayName}`}
        className="absolute inset-0 z-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
      />
      <div className="relative z-[1] pointer-events-none">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-900">{displayName}</h3>
            <p className="mt-0.5 text-[11px] font-mono uppercase tracking-wide text-slate-400">
              {system.id}
            </p>
          </div>
          <Badge tone={postureTone(system.risk_posture)} dot>
            {humanizeLabel(system.risk_posture)}
          </Badge>
        </div>

        <dl
          className={cn(
            "mt-3 grid gap-x-3 gap-y-1.5 text-xs",
            compact ? "grid-cols-2" : "grid-cols-2 md:grid-cols-2"
          )}
        >
          <div className="min-w-0">
            <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Owner</dt>
            <dd className="truncate text-slate-700">{system.owner ?? "—"}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Function</dt>
            <dd className="truncate text-slate-700">{system.business_function ?? "—"}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Sensitivity</dt>
            <dd className="truncate text-slate-700">
              {humanizeLabel(system.regulatory_sensitivity)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Scope</dt>
            <dd className="truncate text-slate-700">
              {humanizeLabel(system.deployment_scope)}
            </dd>
          </div>
        </dl>

        <div className="mt-3 flex items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50/70 px-2.5 py-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold tabular-nums text-slate-900">{openCount}</span>
              <span className="text-slate-500">open incident{openCount === 1 ? "" : "s"}</span>
              {highestSeverity ? (
                <Badge tone={severityTone(highestSeverity)} size="xs">
                  {humanizeLabel(highestSeverity)}
                </Badge>
              ) : (
                <Badge tone="low" size="xs">
                  No issues
                </Badge>
              )}
            </div>
            <p
              className="mt-1 truncate text-[11px] text-slate-600"
              title={topIssueTitle ?? undefined}
            >
              {topIssueTitle ?? "No active governance issues"}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-700" />
        </div>
      </div>
      <div className="relative z-[2] mt-2.5 flex items-center justify-end">
        <AnalyzeWithBob
          targetType="system"
          targetId={system.id}
          label="Ask Bob"
        />
      </div>
    </div>
  );
}
