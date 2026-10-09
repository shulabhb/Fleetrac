/**
 * Governed action types and tab helpers — Action Center reads from governance API.
 */

import {
  resolveActionVerificationUx,
  type ActionLane
} from "@/lib/action-verification-ux";

export type GovernedActionSource =
  | "Incident Queue"
  | "Evidence Library" // legacy token — display via displayGovernedActionSource
  | "Live Signals";

/** User-facing source label (no "Evidence Library" / "Incident Queue" product drift). */
export function displayGovernedActionSource(source: GovernedActionSource): string {
  if (source === "Evidence Library") return "Outcomes";
  if (source === "Incident Queue") return "Risk Queue";
  return source;
}

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
  /** Coarse bucket for legacy helpers */
  verificationStatus: GovernedVerificationStatus;
  /** Raw API verification_status (e.g. "Improvement Observed", "Monitoring") */
  rawVerificationStatus: string;
  riskLevel: "low" | "medium" | "high";
  createdAtLabel: string;
  slackNotifiedAt?: string;
  approver?: string;
  decidedAt?: number;
  createdAtMs: number;
  governanceSource?: "api";
  expectedMetric?: string | null;
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

export function actionLane(action: GovernedAction): ActionLane {
  return resolveActionVerificationUx({
    status: action.status,
    verificationStatus: action.verificationStatus,
    rawVerificationStatus: action.rawVerificationStatus,
    incidentId: action.incidentId
  }).lane;
}

/**
 * Three Action Center lanes:
 * - pending → awaiting decision
 * - ready → approved / ready to verify / under verification
 * - closed → verification results (+ rejected / policy-blocked)
 */
export function governedInTab(
  action: GovernedAction,
  tab: "pending" | "ready" | "closed"
): boolean {
  const lane = actionLane(action);
  if (tab === "pending") return lane === "awaiting_decision";
  if (tab === "ready") return lane === "ready_to_verify";
  return lane === "verification_result";
}

export function canVerifyAction(action: GovernedAction): boolean {
  if (action.governanceSource !== "api") return false;
  return resolveActionVerificationUx({
    status: action.status,
    verificationStatus: action.verificationStatus,
    rawVerificationStatus: action.rawVerificationStatus,
    incidentId: action.incidentId
  }).canRecordVerification;
}
