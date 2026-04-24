import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { humanizeLabel, postureTone, severityTone } from "@/lib/present";
import { cn } from "@/lib/cn";
import { AnalyzeWithBob } from "@/components/bob/analyze-with-bob";
import { routeToSystem } from "@/lib/routes";

type SystemCardProps = {
  system: any;
  openCount: number;
  highestSeverity?: "high" | "medium" | "low" | null;
  topIssueTitle?: string | null;
  href?: string;
  compact?: boolean;
};

export function SystemCard({
  system,
  openCount,
  highestSeverity,
  topIssueTitle,
  href,
  compact
}: SystemCardProps) {
  const target = href ?? routeToSystem(system.id);
  const displayName = system.use_case
    ? `${system.use_case} (${system.model})`
    : (system.name ?? system.id);

  return (
    <div
      className={cn(
        "group relative rounded-lg border border-slate-200 bg-white p-3 transition",
        "hover:border-slate-300 hover:shadow-card-hover focus-within:border-slate-400"
      )}
    >
      <Link
        href={target}
        aria-label={`View production context for ${displayName}`}
        className="absolute inset-0 z-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
      />
      <div className="pointer-events-none relative z-[1]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-900">{displayName}</h3>
            <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wide text-slate-400">
              {system.id}
            </p>
          </div>
          <Badge tone={postureTone(system.risk_posture)} dot size="sm">
            {humanizeLabel(system.risk_posture)}
          </Badge>
        </div>

        <dl
          className={cn(
            "mt-3 grid gap-x-3 gap-y-1.5 text-xs",
            compact ? "grid-cols-2" : "grid-cols-2 md:grid-cols-2"
          )}
        >
          <MetaField label="Owner" value={system.owner ?? "—"} />
          <MetaField label="Function" value={system.business_function ?? "—"} />
          <MetaField
            label="Sensitivity"
            value={humanizeLabel(system.regulatory_sensitivity)}
          />
          <MetaField label="Scope" value={humanizeLabel(system.deployment_scope)} />
        </dl>

        <div className="mt-3 flex items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50/70 px-2.5 py-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold tabular-nums text-slate-900">{openCount}</span>
              <span className="text-slate-500">
                open {openCount === 1 ? "incident" : "incidents"}
              </span>
              {openCount > 0 && highestSeverity ? (
                <Badge tone={severityTone(highestSeverity)} size="xs">
                  {humanizeLabel(highestSeverity)}
                </Badge>
              ) : (
                <Badge tone="low" size="xs">
                  No open issues
                </Badge>
              )}
            </div>
            <p
              className="mt-1 line-clamp-1 text-[11px] text-slate-600"
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
          label="Review Bob analysis"
        />
      </div>
    </div>
  );
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="truncate text-slate-700">{value}</dd>
    </div>
  );
}
