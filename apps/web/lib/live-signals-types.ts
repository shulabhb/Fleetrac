/** Live Signals display types — feed data from governance API when enabled. */

export type LiveSignalSeverity = "Critical" | "High" | "Medium" | "Low" | "Healthy";

export type LiveSignalCategory =
  | "Drift"
  | "Grounding"
  | "Policy"
  | "Latency"
  | "Security"
  | "Cost";

export type LiveRuntimeSignal = {
  id: string;
  systemId: string;
  canonicalSystemId: string;
  systemName: string;
  modelLabel?: string;
  ownerTeam: string;
  category: LiveSignalCategory;
  severity: LiveSignalSeverity;
  summary: string;
  detectedAt: string;
  incidentLinked: boolean;
  incidentId?: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  latencyMs?: number;
  signalState?: string;
};

export type LiveSignalsSummary = {
  active: number;
  critical: number;
  linkedIncidents: number;
  systemsAffected: number;
};
