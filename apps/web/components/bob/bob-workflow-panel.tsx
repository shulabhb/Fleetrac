"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ClipboardList, Flag, RefreshCcw, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import type { BobInvestigation, InvestigationStatus } from "@/lib/bob-types";
import { readBobState, setInvestigationOverride } from "@/lib/bob-state";
import { InvestigationStatusBadge } from "./bob-badges";
import { formatRelativeTime } from "@/lib/format";

type Props = {
  investigation: BobInvestigation;
};

const HELPER: Record<InvestigationStatus, string> = {
  draft: "Bob is still drafting. Not ready for human review yet.",
  ready_for_review:
    "Bob has drafted an investigation. A reviewer should validate the evidence and root cause.",
  awaiting_approval:
    "Primary recommendation requires governance approval before Bob can proceed.",
  approved:
    "Recommendation was approved. Bob is ready to hand off to the owner team.",
  rejected:
    "Recommendation was rejected. No remediation will be executed by Bob.",
  executed:
    "Remediation was executed. Bob is monitoring the outcome window.",
  monitoring_outcome:
    "Bob is watching telemetry to confirm the remediation stuck."
};

export function BobInvestigationWorkflow({ investigation }: Props) {
  const [status, setStatus] = useState<InvestigationStatus>(investigation.status);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    const state = readBobState();
    const override = state.investigations[investigation.id];
    if (override?.status) {
      setStatus(override.status);
      setUpdatedAt(override.updatedAt ?? null);
    }
  }, [investigation.id]);

  const change = (next: InvestigationStatus) => {
    setStatus(next);
    const ts = new Date().toISOString();
    setUpdatedAt(ts);
    setInvestigationOverride(investigation.id, { status: next });
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Workflow</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Governance action on Bob&apos;s recommendation.
          </p>
        </div>
        <InvestigationStatusBadge status={status} />
      </div>

      <p className="mt-3 rounded-md border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs leading-relaxed text-slate-600">
        {HELPER[status]}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <WorkflowButton
          label="Approve recommendation"
          hint="Approves Bob's primary fix"
          icon={CheckCircle2}
          tone="emerald"
          active={status === "approved"}
          onClick={() => change("approved")}
        />
        <WorkflowButton
          label="Reject recommendation"
          hint="Rejects and closes Bob's plan"
          icon={XCircle}
          tone="rose"
          active={status === "rejected"}
          onClick={() => change("rejected")}
        />
        <WorkflowButton
          label="Mark for follow-up"
          hint="Needs more review before deciding"
          icon={ClipboardList}
          tone="amber"
          active={status === "ready_for_review"}
          onClick={() => change("ready_for_review")}
        />
        <WorkflowButton
          label="Escalate with Bob notes"
          hint="Routes to owner team with evidence"
          icon={Flag}
          tone="indigo"
          active={status === "executed"}
          onClick={() => change("executed")}
        />
      </div>

      {updatedAt ? (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500">
          <RefreshCcw className="h-3 w-3" />
          Updated {formatRelativeTime(updatedAt)} · saved in demo session
        </p>
      ) : (
        <p className="mt-3 text-[11px] text-slate-400">
          Actions persist in this browser only (mock governance state).
        </p>
      )}
    </section>
  );
}

function WorkflowButton({
  label,
  hint,
  icon: Icon,
  tone,
  active,
  onClick
}: {
  label: string;
  hint: string;
  icon: typeof CheckCircle2;
  tone: "emerald" | "rose" | "amber" | "indigo";
  active: boolean;
  onClick: () => void;
}) {
  const toneMap: Record<string, { active: string; hover: string; iconColor: string }> = {
    emerald: {
      active: "border-emerald-300 bg-emerald-50 text-emerald-700",
      hover: "hover:border-emerald-200 hover:text-emerald-700",
      iconColor: "text-emerald-500"
    },
    rose: {
      active: "border-rose-300 bg-rose-50 text-rose-700",
      hover: "hover:border-rose-200 hover:text-rose-700",
      iconColor: "text-rose-500"
    },
    amber: {
      active: "border-amber-300 bg-amber-50 text-amber-800",
      hover: "hover:border-amber-200 hover:text-amber-800",
      iconColor: "text-amber-500"
    },
    indigo: {
      active: "border-indigo-300 bg-indigo-50 text-indigo-700",
      hover: "hover:border-indigo-200 hover:text-indigo-700",
      iconColor: "text-indigo-500"
    }
  };
  const t = toneMap[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-start gap-2 rounded-md border border-slate-200 bg-white p-2.5 text-left text-xs transition",
        active ? t.active : cn("text-slate-700", t.hover)
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", active ? "" : t.iconColor)} />
      <span className="min-w-0">
        <span className="block font-medium">{label}</span>
        <span className="block text-[11px] text-slate-500">{hint}</span>
      </span>
    </button>
  );
}
