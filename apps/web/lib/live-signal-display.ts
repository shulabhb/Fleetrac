export type MonitorSignalState =
  | "Healthy"
  | "Signal degrading"
  | "Control breached"
  | "Post-action verification"
  | "Regression";

export type SignalDisplayInput = {
  operationType?: string | null;
  normalizedSignalType?: string | null;
  signalState?: string | null;
  severity?: string | null;
  incidentId?: string | null;
  latencyMs?: number | null;
  evaluation?: Record<string, unknown> | null;
};

const METRIC_KEYS = [
  "unsupported_claim_rate",
  "grounding_score",
  "operation_latency_ms",
  "latency_ms",
  "tool_scope_violation",
  "retrieval_failure_rate"
] as const;

export function monitorSignalState(input: SignalDisplayInput): MonitorSignalState {
  const operation = (input.operationType ?? "").toLowerCase();
  const signal = (input.normalizedSignalType ?? "").toLowerCase();
  const state = (input.signalState ?? "").toLowerCase();
  if (
    operation.includes("verif") ||
    signal.includes("post_action") ||
    signal.includes("recovery")
  ) {
    return "Post-action verification";
  }
  if (signal.includes("regression")) return "Regression";
  if (input.incidentId) return "Control breached";
  if (state === "warning" || (input.severity && input.severity !== "Healthy" && state !== "healthy")) {
    return "Signal degrading";
  }
  return "Healthy";
}

export function linkageCopy(state: MonitorSignalState, incidentId?: string | null): string {
  if (incidentId && (state === "Control breached" || state === "Regression" || state === "Post-action verification")) {
    return `Linked risk: ${incidentId}`;
  }
  return "Below threshold — no risk created";
}

export function keyMetricLine(
  evaluation: Record<string, unknown> | null | undefined,
  latencyMs?: number | null
): string | null {
  const source = evaluation ?? {};
  for (const key of METRIC_KEYS) {
    const raw = source[key];
    if (raw == null || raw === "") continue;
    const value = Number(raw);
    if (Number.isNaN(value)) continue;
    const label = key.replace(/_/g, " ").replace("operation ", "");
    const shown = Math.abs(value) >= 10 ? String(Math.round(value)) : value.toFixed(3);
    return key.includes("latency") ? `${label} ${shown} ms` : `${label} ${shown}`;
  }
  if (latencyMs != null) return `latency ${Math.round(latencyMs)} ms`;
  return null;
}

export function matchesSignalFilters(
  input: {
    systemId: string;
    eventType: string;
    state: MonitorSignalState;
  },
  filters: { systemId?: string; eventType?: string; state?: string }
): boolean {
  if (filters.systemId && filters.systemId !== "all" && input.systemId !== filters.systemId) {
    return false;
  }
  if (filters.eventType && filters.eventType !== "all" && input.eventType !== filters.eventType) {
    return false;
  }
  if (filters.state && filters.state !== "all" && input.state !== filters.state) return false;
  return true;
}
