/**
 * Pitchable governed action catalog — Action Center inbox (no API sample rows).
 */

import type { DemoWorkflowActionItem } from "@/lib/governance-demo-actions";
import { allOwnerQueueRows } from "@/lib/incident-queue-owner-review-mock";
import { FLEETRAC_ANALYSIS_BY_INCIDENT } from "@/lib/governance-demo-model-analysis";

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
  | "Policy-blocked";

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
  /** Session overlay timestamp when decided */
  decidedAt?: number;
  createdAtMs: number;
};

function severityToRisk(severity: string): "low" | "medium" | "high" {
  const s = severity.toLowerCase();
  if (s.includes("critical") || s.includes("high")) return "high";
  if (s.includes("medium")) return "medium";
  return "low";
}

function rowToGoverned(
  row: ReturnType<typeof allOwnerQueueRows>[0],
  overrides: Partial<GovernedAction> = {}
): GovernedAction {
  const incidentId = row.incidentId;
  return {
    id: `act-${incidentId}`,
    incidentId,
    systemId: row.systemId,
    incidentTitle: row.title,
    ownerTeam: row.ownerTeam,
    assignedTo: row.assignedTo,
    systemName: row.systemName,
    riskCategory: row.riskCategory,
    severity: row.severityLabel,
    source: "Incident Queue",
    recommendedAction: row.recommendedAction,
    fleetracAnalysisSummary:
      FLEETRAC_ANALYSIS_BY_INCIDENT[incidentId] ?? row.evidenceSummary,
    executionMode: "approval_required",
    status: "Awaiting approval",
    verificationStatus: "Not started",
    riskLevel: severityToRisk(row.severityLabel),
    createdAtLabel: row.ageLabel,
    slackNotifiedAt: "8m ago",
    createdAtMs: Date.now() - 86400000 * 3,
    ...overrides
  };
}

/** Seed catalog aligned to owner queue incidents. */
export const GOVERNED_ACTIONS_CATALOG: GovernedAction[] = [
  rowToGoverned(
    allOwnerQueueRows().find((r) => r.incidentId === "inc-mrm-001")!,
    {
      executionMode: "approval_required",
      status: "Awaiting approval"
    }
  ),
  rowToGoverned(
    allOwnerQueueRows().find((r) => r.incidentId === "inc-mrm-002")!,
    { status: "Awaiting approval", executionMode: "approval_required" }
  ),
  rowToGoverned(
    allOwnerQueueRows().find((r) => r.incidentId === "inc-sec-001")!,
    {
      status: "Awaiting approval",
      executionMode: "auto_in_scope",
      source: "Live Signals"
    }
  ),
  rowToGoverned(
    allOwnerQueueRows().find((r) => r.incidentId === "inc-plat-001")!,
    {
      status: "Approved",
      verificationStatus: "Awaiting measurement",
      executionMode: "approval_required",
      approver: "Sofia Martinez",
      createdAtLabel: "4d"
    }
  ),
  {
    id: "act-policy-001",
    incidentId: "inc-gov-001",
    systemId: "M44",
    incidentTitle: "Dual approval required for threshold change",
    ownerTeam: "Model Risk Management",
    assignedTo: "Anika Rao",
    systemName: "Invoice OCR Validation",
    riskCategory: "Governance",
    severity: "High",
    source: "Evidence Library" as const,
    recommendedAction: "Escalate to secondary approver before deploying threshold patch.",
    fleetracAnalysisSummary:
      "Proposed configuration change exceeds single-approver policy bound for regulated OCR paths.",
    executionMode: "approval_required",
    status: "Policy-blocked",
    verificationStatus: "Not started",
    riskLevel: "high",
    createdAtLabel: "2d",
    slackNotifiedAt: "1d ago",
    createdAtMs: Date.now() - 172800000
  },
  {
    id: "act-auto-001",
    incidentId: "inc-auto-001",
    systemId: "A18",
    incidentTitle: "Rotate stale agent credentials (in scope)",
    ownerTeam: "Security Operations",
    assignedTo: "Fleetrac",
    systemName: "Internal Copilot Gateway",
    riskCategory: "Cyber",
    severity: "Medium",
    source: "Live Signals" as const,
    recommendedAction: "Rotate credentials and invalidate active sessions per runbook RB-12.",
    fleetracAnalysisSummary:
      "Credential age exceeded policy; action is within Fleetrac auto-remediation scope with audit linkage.",
    executionMode: "auto_in_scope",
    status: "Executed",
    verificationStatus: "Complete",
    riskLevel: "medium",
    createdAtLabel: "6h",
    slackNotifiedAt: "6h ago",
    approver: "Auto · in scope",
    createdAtMs: Date.now() - 21600000
  }
].filter(Boolean) as GovernedAction[];

export function governedSelectionId(actionId: string): string {
  return `gov:${actionId}`;
}

export function parseGovernedSelectionId(id: string): string | null {
  return id.startsWith("gov:") ? id.slice(4) : null;
}

function mapSessionStatus(s: DemoWorkflowActionItem["status"]): GovernedActionStatus {
  if (s === "Approved") return "Approved";
  if (s === "Rejected") return "Rejected";
  return "Awaiting approval";
}

function sessionToGoverned(s: DemoWorkflowActionItem): GovernedAction {
  return {
    id: `act-${s.incidentId}`,
    incidentId: s.incidentId,
    systemId: "—",
    incidentTitle: s.incidentTitle,
    ownerTeam: s.ownerTeam,
    assignedTo: s.assignedTo ?? "—",
    systemName: s.systemName ?? "—",
    riskCategory: s.riskCategory ?? "—",
    severity: s.severity ?? "—",
    source: s.source,
    recommendedAction: s.recommendedAction ?? "Review governed recommendation.",
    fleetracAnalysisSummary:
      FLEETRAC_ANALYSIS_BY_INCIDENT[s.incidentId] ??
      "Fleetrac correlated telemetry, policy signals, and evidence for this incident.",
    executionMode: "approval_required",
    status: mapSessionStatus(s.status),
    verificationStatus: s.verificationStatus,
    riskLevel: severityToRisk(s.severity ?? ""),
    createdAtLabel: "Just now",
    createdAtMs: s.createdAt,
    decidedAt: s.decidedAt,
    slackNotifiedAt: "Just now"
  };
}

/** Merge session handoffs over catalog (incidentId dedupe). */
export function mergeGovernedActions(
  sessionItems: DemoWorkflowActionItem[] = []
): GovernedAction[] {
  const map = new Map<string, GovernedAction>();
  for (const a of GOVERNED_ACTIONS_CATALOG) {
    map.set(a.incidentId, { ...a });
  }
  for (const s of sessionItems) {
    const existing = map.get(s.incidentId);
    if (existing) {
      map.set(s.incidentId, {
        ...existing,
        incidentTitle: s.incidentTitle,
        ownerTeam: s.ownerTeam,
        assignedTo: s.assignedTo ?? existing.assignedTo,
        systemName: s.systemName ?? existing.systemName,
        riskCategory: s.riskCategory ?? existing.riskCategory,
        severity: s.severity ?? existing.severity,
        source: s.source,
        recommendedAction: s.recommendedAction ?? existing.recommendedAction,
        status: mapSessionStatus(s.status),
        verificationStatus: s.verificationStatus,
        createdAtMs: s.createdAt,
        decidedAt: s.decidedAt
      });
    } else {
      map.set(s.incidentId, sessionToGoverned(s));
    }
  }
  return Array.from(map.values()).sort((a, b) => b.createdAtMs - a.createdAtMs);
}

export function governedInTab(action: GovernedAction, tab: "pending" | "ready" | "closed"): boolean {
  if (tab === "pending") {
    return action.status === "Awaiting approval";
  }
  if (tab === "ready") {
    return action.status === "Approved" || action.status === "Executed";
  }
  return action.status === "Rejected" || action.status === "Policy-blocked";
}
