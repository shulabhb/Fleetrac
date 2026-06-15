/**
 * Governed action types and tab helpers — Action Center reads from governance API.
 */

export type GovernedActionSource =
  | "Incident Queue"
  | "Evidence Library"
  | "Live Signals";

export type GovernedExecutionMode =
  | "approval_required"
  | "auto_in_scope"
  | "notify_only";

export type GovernedActionStatus =
  | "Awaiting approval"
  | "Approved"
  | "Rejected"
  | "Executed"
  | "Policy-blocked"
  | "Monitoring"
  | "Closed"
  | "Rollback candidate";

export type GovernedVerificationStatus =
  | "Not started"
  | "Awaiting measurement"
  | "Complete";

export type GovernedAction = {
  id: string;
  incidentId: string;
  systemId: string;
  incidentTitle: string;
  ownerTeam: string;
  assignedTo: string;
  systemName: string;
  riskCategory: string;
  severity: string;
  source: GovernedActionSource;
  recommendedAction: string;
  fleetracAnalysisSummary: string;
  executionMode: GovernedExecutionMode;
  status: GovernedActionStatus;
  verificationStatus: GovernedVerificationStatus;
  riskLevel: "low" | "medium" | "high";
  createdAtLabel: string;
  slackNotifiedAt?: string;
  approver?: string;
  decidedAt?: number;
  createdAtMs: number;
  governanceSource?: "api";
};

export function governedSelectionId(actionId: string): string {
  return `gov:${actionId}`;
}

export function parseGovernedSelectionId(id: string): string | null {
  return id.startsWith("gov:") ? id.slice(4) : null;
}

export function isDemoHighRisk(severity?: string): boolean {
  const s = severity?.toLowerCase() ?? "";
  return s.includes("critical") || s.includes("high");
}

export function governedInTab(
  action: GovernedAction,
  tab: "pending" | "ready" | "closed"
): boolean {
  if (tab === "pending") {
    return action.status === "Awaiting approval";
  }
  if (tab === "ready") {
    return (
      action.status === "Approved" ||
      action.status === "Executed" ||
      action.status === "Monitoring" ||
      action.status === "Closed"
    );
  }
  return (
    action.status === "Rejected" ||
    action.status === "Policy-blocked" ||
    action.status === "Rollback candidate"
  );
}

export function canVerifyAction(action: GovernedAction): boolean {
  return (
    action.governanceSource === "api" &&
    (action.status === "Approved" ||
      action.status === "Monitoring" ||
      action.status === "Executed") &&
    action.verificationStatus !== "Complete"
  );
}
