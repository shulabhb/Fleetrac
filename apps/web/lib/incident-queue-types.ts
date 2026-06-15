/** Incident Queue row types and display helpers — data from governance API when enabled. */

export type OwnerReviewTableRow = {
  incidentId: string;
  priority: "P1" | "P2" | "P3";
  title: string;
  systemId: string;
  systemName: string;
  riskCategory: string;
  severityLabel: string;
  stage: string;
  assignedTo: string;
  evidenceItemsCount: number;
  evidenceSyncStatus?: "Synced" | "Needs refresh";
  ageLabel: string;
  nextAction: string;
  decisionNeeded: string;
  recommendedAction: string;
  evidenceSummary: string;
  investigationTimeline: string;
};

export type QueueTableRow = OwnerReviewTableRow & { ownerTeam: string };

export const PRIMARY_OWNER_QUEUE_TEAMS = [
  "Model Risk Management",
  "Security Operations",
  "Platform Reliability"
] as const;

export function formatQueueEvidenceLabel(row: {
  evidenceItemsCount: number;
  evidenceSyncStatus?: "Synced" | "Needs refresh";
}): string {
  const status = row.evidenceSyncStatus ?? "Synced";
  return `${status} · ${row.evidenceItemsCount} items`;
}

export function fleetracAnalysisForQueueIncident(
  incidentId: string,
  fallback: string
): string {
  return fallback;
}
