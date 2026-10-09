/** Risk Queue row types and display helpers — data from governance API when enabled. */

export type OwnerReviewTableRow = {
  incidentId: string;
  canonicalId?: string;
  priority: "P1" | "P2" | "P3";
  title: string;
  systemId: string;
  systemCanonicalId?: string;
  systemName: string;
  riskCategory: string;
  severityLabel: string;
  stage: string;
  assignedTo: string;
  evidenceItemsCount: number;
  evidenceSyncStatus?: "Synced" | "Needs refresh";
  ageLabel: string;
  updatedLabel?: string;
  nextAction: string;
  decisionNeeded: string;
  recommendedAction: string;
  evidenceSummary: string;
  investigationTimeline: string;
  diagnosisFamily?: string | null;
  diagnosisLabel?: string | null;
  severityReason?: string | null;
  highestSeverity?: string | null;
  responderTeam?: string | null;
  /** Phase G — runtime breach snapshot */
  controlId?: string | null;
  controlName?: string | null;
  metricName?: string | null;
  thresholdValue?: number | null;
  thresholdOperator?: string | null;
  latestObservedValue?: number | null;
  worstObservedValue?: number | null;
  eventCount?: number | null;
  triggerEventId?: string | null;
  lastSeenAt?: string | null;
};

export type QueueTableRow = OwnerReviewTableRow & { ownerTeam: string };

export const DIAGNOSIS_FAMILY_LABELS: Record<string, string> = {
  output_reliability_control_degradation: "Output reliability control degradation",
  prompt_injection_tool_governance_violation:
    "Prompt-injection-driven tool governance violation",
  provider_degradation_routing_reliability:
    "Provider degradation affecting routing reliability"
};

export function diagnosisLabelFor(family: string | null | undefined): string | null {
  if (!family) return null;
  return DIAGNOSIS_FAMILY_LABELS[family] ?? family.replace(/_/g, " ");
}

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
