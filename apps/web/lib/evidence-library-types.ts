/** Evidence Library types and lifecycle helpers — records from governance API when enabled. */

export type TeamLibraryRow = {
  ownerTeam: string;
  handoff: string;
  activeIncidents: number;
  critical: number;
  bottleneck: string;
  evidenceStatus: "Synced" | "Needs refresh";
  lastUpdated: string;
};

export type OwnerIncidentRecord = {
  id: string;
  title: string;
  systemName: string;
  risk: string;
  severity: string;
  stage: string;
  assigned: string;
  evidenceCount: number;
  lastUpdated: string;
  confidence: "High" | "Medium" | "Low";
  nextAction: string;
};

export type ResolvedArchiveRecord = {
  id: string;
  title: string;
  systemName: string;
  outcome: string;
  closedAt: string;
  evidenceCount: number;
  verificationResult: string;
};

export const INCIDENT_LIFECYCLE_ORDER = [
  "signal",
  "packaged",
  "owner_notified",
  "owner_review",
  "action_approval",
  "remediation",
  "verification",
  "closed"
] as const;

const DEFAULT_STEP_LABEL: Record<string, string> = {
  signal: "Signal detected",
  packaged: "Incident packaged",
  owner_notified: "Owner notified",
  owner_review: "Owner review",
  action_approval: "Action approval",
  remediation: "Remediation",
  verification: "Verification",
  closed: "Closed / archived"
};

export function lifecycleLabel(key: string): string {
  return DEFAULT_STEP_LABEL[key] ?? key;
}

export type FleetracAnalysisBlock = {
  narrative: string;
  rootSignal: string;
  likelyCause: string;
  governanceImplication: string;
};

export type StructuredEvidenceRow = {
  evidenceItem: string;
  source: string;
  signal: string;
  governanceRelevance: string;
  status: string;
  timestamp: string;
  rawLog: Record<string, unknown>;
};

export type IncidentEvidenceDetail = {
  id: string;
  title: string;
  recordSubtitle: string;
  subtitleParts: string[];
  currentStageKey: string;
  assigned: string;
  lastUpdated: string;
  evidenceConfidence: "High" | "Medium" | "Low";
  summary: string;
  systemName: string;
  ownerTeam: string;
  severity: string;
  riskCategory: string;
  teamLead: string;
  decisionNeeded: string;
  decisionStatus: string;
  decisionNotes: string;
  recommendedAction: string;
  expectedImpact: string;
  nextStep: string;
  outcomeVerification: "not_started" | "complete";
  outcomeReason?: string;
  nextMeasurementWindow?: string;
  outcomeResult?: string;
  fleetracAnalysis?: FleetracAnalysisBlock;
  structuredEvidence?: StructuredEvidenceRow[];
  actionHandoffPreview?: string[];
  lifecycleTimestamps: Partial<
    Record<
      string,
      { label: string; at?: string; state: "done" | "current" | "pending" }
    >
  >;
  evidenceItems: {
    title: string;
    source: string;
    status: string;
    timestamp: string;
  }[];
};
