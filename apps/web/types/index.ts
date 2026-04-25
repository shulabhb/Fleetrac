export type Severity = "low" | "medium" | "high";
export type IncidentStatus = "open" | "pending" | "closed";
export type RiskPosture = "healthy" | "watch" | "at_risk" | "critical";
export type RiskCategory =
  | "technology risk"
  | "cyber risk"
  | "governance / compliance risk"
  | "output reliability risk";

export type TelemetryEvent = {
  id: string;
  systemId: string;
  modelName: string;
  timestamp: string;
  accuracyPct: number | null;
  errorPct: number | null;
  latencyP95Ms: number | null;
  driftIndex: number | null;
  groundingScore: number | null;
  unsupportedClaimRate: number | null;
  retrievalFailureRate: number | null;
  auditCoveragePct: number | null;
  policyViolationRate: number | null;
  securityAnomalyCount: number | null;
  costPer1kRequests: number | null;
  riskSignals: string[];
};

export type Incident = {
  id: string;
  title: string;
  category: string;
  riskCategory: RiskCategory;
  incidentStatus: IncidentStatus;
  escalationStatus: "not_escalated" | "pending" | "escalated";
  reviewRequired: boolean;
  severity: Severity;
  systemId: string;
  systemName: string;
  ruleId: string;
  triggerMetric: string;
  triggerReason: string;
  threshold: string;
  observedValue: number;
  expectedValue: number | null;
  summary: string;
  recommendedAction: string;
  ownerTeam: string;
  createdAt: string;
};

export type Rule = {
  id: string;
  name: string;
  description: string;
  category: string;
  comparator: ">" | "<" | ">=" | "<=";
  thresholdField: string;
  observedField: string;
  severity: Severity;
  enabled: boolean;
};

export type System = {
  id: string;
  name: string;
  owner: string;
  environment: "staging" | "production";
  model: string;
  modelType: string;
  useCase: string;
  telemetryArchetype: string;
  businessFunction: string;
  deploymentScope: string;
  regulatorySensitivity: string;
  controlOwner: string;
  riskPosture: RiskPosture;
};

export type AuditLogEntry = {
  id: string;
  actor: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  timestamp: string;
};
