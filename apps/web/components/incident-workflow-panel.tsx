"use client";

import { useMemo, useState } from "react";
import { readDemoState, setIncidentDemoState } from "@/lib/demo-state";
import { humanizeLabel } from "@/lib/present";

type WorkflowPanelProps = {
  incidentId: string;
  initialIncidentStatus: string;
  initialEscalationStatus: string;
  initialReviewRequired: boolean;
};

function statusBadge(status: string) {
  if (status === "escalated") return "bg-rose-100 text-rose-700 ring-1 ring-rose-200";
  if (status === "under_review") return "bg-amber-100 text-amber-700 ring-1 ring-amber-200";
  if (status === "mitigated") return "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200";
  if (status === "closed") return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
  return "bg-blue-100 text-blue-700 ring-1 ring-blue-200";
}

export function IncidentWorkflowPanel({
  incidentId,
  initialIncidentStatus,
  initialEscalationStatus,
  initialReviewRequired
}: WorkflowPanelProps) {
  const saved = readDemoState()[incidentId];
  const [incidentStatus, setIncidentStatus] = useState(initialIncidentStatus);
  const [escalationStatus, setEscalationStatus] = useState(initialEscalationStatus);
  const [reviewRequired, setReviewRequired] = useState(initialReviewRequired);

  const effectiveIncidentStatus = saved?.incidentStatus ?? incidentStatus;
  const effectiveEscalationStatus = saved?.escalationStatus ?? escalationStatus;
  const effectiveReviewRequired = saved?.reviewRequired ?? reviewRequired;

  const helperText = useMemo(() => {
    if (effectiveIncidentStatus === "escalated") return "Escalated to leadership workflow.";
    if (effectiveIncidentStatus === "mitigated") return "Mitigation actions logged and active.";
    if (effectiveIncidentStatus === "closed") return "Closed in this demo session.";
    if (effectiveIncidentStatus === "under_review") return "Awaiting reviewer decision.";
    return "New detection queued for review.";
  }, [effectiveIncidentStatus]);

  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="font-semibold">Governance Workflow</h3>
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
        <span className={`rounded-full px-2.5 py-1 ${statusBadge(effectiveIncidentStatus)}`}>
          Lifecycle: {humanizeLabel(effectiveIncidentStatus)}
        </span>
        <span className={`rounded-full px-2.5 py-1 ${statusBadge(effectiveEscalationStatus)}`}>
          Escalation: {humanizeLabel(effectiveEscalationStatus)}
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 ring-1 ring-slate-200">
          Review Required: {effectiveReviewRequired ? "Yes" : "No"}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => {
            setIncidentStatus("under_review");
            setEscalationStatus("pending");
            setReviewRequired(true);
            setIncidentDemoState(incidentId, {
              incidentStatus: "under_review",
              escalationStatus: "pending",
              reviewRequired: true
            });
          }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
        >
          Confirm Incident
        </button>
        <button
          onClick={() => {
            setIncidentStatus("closed");
            setEscalationStatus("not_escalated");
            setReviewRequired(false);
            setIncidentDemoState(incidentId, {
              incidentStatus: "closed",
              escalationStatus: "not_escalated",
              reviewRequired: false
            });
          }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
        >
          Mark False Positive
        </button>
        <button
          onClick={() => {
            setIncidentStatus("escalated");
            setEscalationStatus("escalated");
            setReviewRequired(true);
            setIncidentDemoState(incidentId, {
              incidentStatus: "escalated",
              escalationStatus: "escalated",
              reviewRequired: true
            });
          }}
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 hover:bg-amber-100"
        >
          Escalate
        </button>
        <button
          onClick={() => {
            setIncidentStatus("mitigated");
            setEscalationStatus("not_escalated");
            setReviewRequired(false);
            setIncidentDemoState(incidentId, {
              incidentStatus: "mitigated",
              escalationStatus: "not_escalated",
              reviewRequired: false
            });
          }}
          className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 hover:bg-emerald-100"
        >
          Resolve
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">{helperText}</p>
    </div>
  );
}
