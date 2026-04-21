export type TelemetryEvent = {
  id: string;
  systemId: string;
  modelName: string;
  timestamp: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  riskSignals: string[];
};

export type Incident = {
  id: string;
  title: string;
  status: "open" | "in_review" | "resolved";
  severity: "low" | "medium" | "high";
  systemId: string;
  ruleId: string;
  createdAt: string;
};

export type Rule = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
};

export type System = {
  id: string;
  name: string;
  owner: string;
  environment: "staging" | "production";
};

export type AuditLogEntry = {
  id: string;
  actor: string;
  action: string;
  targetType: string;
  targetId: string;
  timestamp: string;
};
