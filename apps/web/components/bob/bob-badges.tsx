import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import type {
  ApprovalStatus,
  ConfidenceTier,
  InvestigationStatus
} from "@/lib/bob-types";

export function ConfidenceBadge({
  tier,
  score,
  withScore = true,
  className
}: {
  tier: ConfidenceTier;
  score?: number;
  withScore?: boolean;
  className?: string;
}) {
  const tone: Record<ConfidenceTier, string> = {
    high: "bg-white text-emerald-800 ring-1 ring-emerald-300",
    medium: "bg-white text-amber-900 ring-1 ring-amber-300",
    low: "bg-white text-slate-700 ring-1 ring-slate-300"
  };
  const label: Record<ConfidenceTier, string> = {
    high: "High confidence",
    medium: "Medium confidence",
    low: "Low confidence"
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
        tone[tier],
        className
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          tier === "high" ? "bg-emerald-500" : tier === "medium" ? "bg-amber-500" : "bg-slate-400"
        )}
      />
      {label[tier]}
      {withScore && typeof score === "number" ? (
        <span className="tabular-nums text-[10px] opacity-80">
          · {Math.round(score * 100)}%
        </span>
      ) : null}
    </span>
  );
}

export function ApprovalBadge({
  status,
  className
}: {
  status: ApprovalStatus;
  className?: string;
}) {
  const config: Record<
    ApprovalStatus,
    { label: string; tone: "neutral" | "high" | "medium" | "low" | "info" | "outline" }
  > = {
    not_required: { label: "No approval required", tone: "outline" },
    pending: { label: "Awaiting approval", tone: "medium" },
    approved: { label: "Approved", tone: "low" },
    rejected: { label: "Rejected", tone: "high" }
  };
  const c = config[status];
  return (
    <Badge tone={c.tone} size="sm" dot className={cn("bg-white", className)}>
      {c.label}
    </Badge>
  );
}

const investigationStatusConfig: Record<
  InvestigationStatus,
  { label: string; className: string }
> = {
  draft: {
    label: "Draft",
    className: "bg-white text-slate-700 ring-1 ring-slate-300"
  },
  ready_for_review: {
    label: "Ready for review",
    className: "bg-white text-sky-800 ring-1 ring-sky-300"
  },
  awaiting_approval: {
    label: "Awaiting approval",
    className: "bg-white text-amber-900 ring-1 ring-amber-300"
  },
  approved: {
    label: "Approved",
    className: "bg-white text-emerald-800 ring-1 ring-emerald-300"
  },
  rejected: {
    label: "Rejected",
    className: "bg-white text-rose-800 ring-1 ring-rose-300"
  },
  executed: {
    label: "Executed",
    className: "bg-white text-indigo-800 ring-1 ring-indigo-300"
  },
  monitoring_outcome: {
    label: "Monitoring outcome",
    className: "bg-white text-violet-800 ring-1 ring-violet-300"
  }
};

export function InvestigationStatusBadge({
  status,
  className
}: {
  status: InvestigationStatus;
  className?: string;
}) {
  const c = investigationStatusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        c.className,
        className
      )}
    >
      {c.label}
    </span>
  );
}

export function investigationStatusLabel(status: InvestigationStatus): string {
  return investigationStatusConfig[status].label;
}
