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
    high: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    medium: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
    low: "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
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
    <Badge tone={c.tone} size="sm" dot className={className}>
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
    className: "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
  },
  ready_for_review: {
    label: "Ready for review",
    className: "bg-sky-50 text-sky-700 ring-1 ring-sky-200"
  },
  awaiting_approval: {
    label: "Awaiting approval",
    className: "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
  },
  approved: {
    label: "Approved",
    className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
  },
  rejected: {
    label: "Rejected",
    className: "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
  },
  executed: {
    label: "Executed",
    className: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
  },
  monitoring_outcome: {
    label: "Monitoring outcome",
    className: "bg-violet-50 text-violet-700 ring-1 ring-violet-200"
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
