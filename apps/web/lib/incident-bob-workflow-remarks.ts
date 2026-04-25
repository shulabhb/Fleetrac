import type { BobInvestigation } from "@/lib/bob-types";

export type BobWorkflowRemarkState = "done" | "active" | "pending";

export type BobWorkflowRemark = {
  id: string;
  text: string;
  state: BobWorkflowRemarkState;
};

/** Deterministic demo ticket id from investigation id (no backend). */
function demoTicketKey(investigationId: string): string {
  const n =
    investigationId.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 800;
  return `GOV-${420 + n}`;
}

/**
 * Operator-facing Bob workflow lines for the incident hero — bounded analysis,
 * approval-gated outputs. Copy stays operational, not anthropomorphic hype.
 */
export function buildBobWorkflowRemarks(
  investigation: BobInvestigation | null,
  hasGovernedAction: boolean
): BobWorkflowRemark[] {
  if (!investigation) {
    return [
      {
        id: "not_started",
        text: "Bob has not started analysis yet — open investigation to queue bounded review.",
        state: "pending"
      }
    ];
  }

  const key = demoTicketKey(investigation.id);
  const hasRecs = investigation.recommendations.length > 0;
  const status = investigation.status;

  const ticketDone =
    hasRecs || status === "ready_for_review" || status === "awaiting_approval" || status === "approved" || status === "executed" || status === "monitoring_outcome";

  const reportComplete =
    status === "approved" || status === "executed" || status === "monitoring_outcome";

  const remarks: BobWorkflowRemark[] = [
    {
      id: "slack",
      text: "Bob pinged the owner lane on Slack with triage context and severity.",
      state: "done"
    },
    {
      id: "ticket",
      text: ticketDone
        ? `Bob opened tracking ticket ${key} and linked this incident.`
        : status === "draft"
          ? `Bob is opening tracking ticket ${key} (in progress).`
          : `Tracking ticket ${key} will attach once analysis advances.`,
      state: ticketDone ? "done" : status === "draft" ? "active" : "pending"
    }
  ];

  if (status === "rejected") {
    remarks.push({
      id: "report_prep",
      text: "Bob prepared an investigation report for review.",
      state: "done"
    });
    remarks.push({
      id: "report_done",
      text: "Review outcome: rejected — Bob can revise recommendations on re-run.",
      state: "active"
    });
  } else if (reportComplete) {
    remarks.push({
      id: "report_prep",
      text: "Bob prepared the investigation report and recommendations.",
      state: "done"
    });
    remarks.push({
      id: "report_done",
      text: "Bob's report is complete — recommendations are ready for governed follow-up.",
      state: "done"
    });
  } else if (status === "awaiting_approval") {
    remarks.push({
      id: "report_prep",
      text: "Bob finalized the investigation report.",
      state: "done"
    });
    remarks.push({
      id: "report_done",
      text: "Bob's report is awaiting approver sign-off (approval-gated).",
      state: "active"
    });
  } else if (status === "ready_for_review") {
    remarks.push({
      id: "report_prep",
      text: "Bob is handing off the investigation report for human review.",
      state: "active"
    });
    remarks.push({
      id: "report_done",
      text: "Report sign-off pending — then recommendations move to Action Center when eligible.",
      state: "pending"
    });
  } else {
    remarks.push({
      id: "report_prep",
      text: "Bob is preparing the investigation report from collected evidence.",
      state: ticketDone ? "active" : "pending"
    });
    remarks.push({
      id: "report_done",
      text: "Bob's report complete — pending review and approval per policy.",
      state: "pending"
    });
  }

  if (hasGovernedAction) {
    remarks.push({
      id: "governed_action",
      text: "Bob drafted a governed remediation in Action Center (policy-checked, reversible where supported).",
      state: "done"
    });
  }

  return remarks;
}
