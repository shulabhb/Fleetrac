import {
  Check,
  FileClock,
  Lock,
  RotateCcw,
  ShieldCheck,
  ShieldOff,
  Target,
  Undo2
} from "lucide-react";
import type { BlastRadius, RiskLevel } from "@/lib/action-types";
import { cn } from "@/lib/cn";

type SafetyBarProps = {
  approvalGated: boolean;
  policyAllowed: boolean;
  reversible: boolean;
  blastRadius: BlastRadius;
  riskLevel: RiskLevel;
  rollbackAvailable?: boolean;
  density?: "default" | "compact";
  className?: string;
};

const blastShort: Record<BlastRadius, string> = {
  single_system: "single system",
  workflow_slice: "workflow slice",
  system_fleet: "fleet-wide",
  non_customer_facing: "non-customer",
  staging_only: "staging only",
  reversible_only: "reversible only"
};

/**
 * A calm chip row that explicitly answers:
 *   "why is this safe to approve?"
 *
 * Fleetrac's trust message is: approval-gated, bounded blast, reversible,
 * policy-checked, auditable. Shown on Action rows (compact) and on the
 * Action detail hero (default).
 */
export function SafetyBar({
  approvalGated,
  policyAllowed,
  reversible,
  blastRadius,
  riskLevel,
  rollbackAvailable,
  density = "default",
  className
}: SafetyBarProps) {
  const size = density === "compact" ? "text-[10.5px]" : "text-[11px]";
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5",
        size,
        className
      )}
    >
      <Chip
        tone={policyAllowed ? "ok" : "bad"}
        icon={policyAllowed ? <ShieldCheck className="h-3 w-3" /> : <ShieldOff className="h-3 w-3" />}
      >
        {policyAllowed ? "Policy-checked" : "Policy-blocked"}
      </Chip>
      <Chip tone="ok" icon={<Lock className="h-3 w-3" />}>
        {approvalGated ? "Approval-gated" : "No approval required"}
      </Chip>
      <Chip
        tone={reversible ? "ok" : "warn"}
        icon={
          reversible ? (
            <Undo2 className="h-3 w-3" />
          ) : (
            <Undo2 className="h-3 w-3" />
          )
        }
      >
        {reversible ? "Reversible" : "Not reversible"}
      </Chip>
      <Chip tone="neutral" icon={<Target className="h-3 w-3" />}>
        Blast · {blastShort[blastRadius]}
      </Chip>
      <Chip
        tone={
          riskLevel === "high"
            ? "warn"
            : riskLevel === "medium"
              ? "warn-soft"
              : "neutral"
        }
        icon={<Check className="h-3 w-3" />}
      >
        {riskLevel === "high"
          ? "High-risk · dual approval"
          : riskLevel === "medium"
            ? "Medium-risk"
            : "Low-risk"}
      </Chip>
      {rollbackAvailable ? (
        <Chip tone="ok" icon={<RotateCcw className="h-3 w-3" />}>
          Rollback available
        </Chip>
      ) : null}
      <Chip tone="neutral" icon={<FileClock className="h-3 w-3" />}>
        Audit-linked
      </Chip>
    </div>
  );
}

type ChipTone = "ok" | "warn" | "warn-soft" | "bad" | "neutral";

function Chip({
  tone,
  icon,
  children
}: {
  tone: ChipTone;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const cls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : tone === "warn"
        ? "bg-rose-50 text-rose-700 ring-rose-200"
        : tone === "warn-soft"
          ? "bg-amber-50 text-amber-800 ring-amber-200"
          : tone === "bad"
            ? "bg-rose-50 text-rose-700 ring-rose-200"
            : "bg-slate-50 text-slate-600 ring-slate-200";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium ring-1",
        cls
      )}
    >
      {icon}
      {children}
    </span>
  );
}
