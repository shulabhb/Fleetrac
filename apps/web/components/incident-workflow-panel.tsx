"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Flag, ShieldCheck, XCircle } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { readDemoState, setIncidentDemoState } from "@/lib/demo-state";
import { humanizeLabel, lifecycleBadgeClasses } from "@/lib/present";

type WorkflowPanelProps = {
  incidentId: string;
  initialIncidentStatus: string;
  initialEscalationStatus: string;
  initialReviewRequired: boolean;
};

export function IncidentWorkflowPanel({
  incidentId,
  initialIncidentStatus,
  initialEscalationStatus,
  initialReviewRequired
}: WorkflowPanelProps) {
  const saved = typeof window !== "undefined" ? readDemoState()[incidentId] : undefined;
  const [incidentStatus, setIncidentStatus] = useState(
    saved?.incidentStatus ?? initialIncidentStatus
  );
  const [escalationStatus, setEscalationStatus] = useState(
    saved?.escalationStatus ?? initialEscalationStatus
  );
  const [reviewRequired, setReviewRequired] = useState(
    saved?.reviewRequired ?? initialReviewRequired
  );

  const helperText = useMemo(() => {
    if (incidentStatus === "escalated") return "Escalated to leadership workflow.";
    if (incidentStatus === "mitigated") return "Mitigation actions logged and active.";
    if (incidentStatus === "closed") return "Closed in this demo session.";
    if (incidentStatus === "under_review") return "Awaiting reviewer decision.";
    return "New detection queued for review.";
  }, [incidentStatus]);

  const apply = (patch: {
    incidentStatus: string;
    escalationStatus: string;
    reviewRequired: boolean;
  }) => {
    setIncidentStatus(patch.incidentStatus);
    setEscalationStatus(patch.escalationStatus);
    setReviewRequired(patch.reviewRequired);
    setIncidentDemoState(incidentId, patch);
  };

  return (
    <Card>
      <CardHeader
        title="Governance workflow"
        caption={helperText}
        action={
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                lifecycleBadgeClasses(incidentStatus)
              )}
            >
              Lifecycle: {humanizeLabel(incidentStatus)}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                lifecycleBadgeClasses(escalationStatus)
              )}
            >
              Escalation: {humanizeLabel(escalationStatus)}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200">
              Review: {reviewRequired ? "Required" : "Not required"}
            </span>
          </div>
        }
      />

      <div className="mt-4 flex flex-wrap gap-2">
        <ActionButton
          icon={ShieldCheck}
          label="Confirm incident"
          hint="Acknowledge and route into review"
          onClick={() =>
            apply({
              incidentStatus: "under_review",
              escalationStatus: "pending",
              reviewRequired: true
            })
          }
        />
        <ActionButton
          icon={XCircle}
          label="Mark false positive"
          hint="Close with no further action"
          onClick={() =>
            apply({
              incidentStatus: "closed",
              escalationStatus: "not_escalated",
              reviewRequired: false
            })
          }
        />
        <ActionButton
          icon={Flag}
          tone="warn"
          label="Escalate"
          hint="Promote to leadership review"
          onClick={() =>
            apply({
              incidentStatus: "escalated",
              escalationStatus: "escalated",
              reviewRequired: true
            })
          }
        />
        <ActionButton
          icon={CheckCircle2}
          tone="ok"
          label="Resolve"
          hint="Log mitigation and close out"
          onClick={() =>
            apply({
              incidentStatus: "mitigated",
              escalationStatus: "not_escalated",
              reviewRequired: false
            })
          }
        />
      </div>
      <p className="mt-3 text-[11px] text-slate-500">
        Demo actions persist locally. Use “Reset demo state” in the sidebar to clear.
      </p>
    </Card>
  );
}

function ActionButton({
  icon: Icon,
  label,
  hint,
  onClick,
  tone = "neutral"
}: {
  icon: typeof ShieldCheck;
  label: string;
  hint: string;
  onClick: () => void;
  tone?: "neutral" | "warn" | "ok";
}) {
  const toneCls =
    tone === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300"
      : tone === "ok"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300"
        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300";
  return (
    <button
      onClick={onClick}
      className={cn(
        "group inline-flex min-w-[180px] items-start gap-2 rounded-md border px-3 py-2 text-left text-sm transition hover:shadow-sm",
        toneCls
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[11px] text-slate-500 group-hover:text-slate-600">{hint}</p>
      </div>
    </button>
  );
}
