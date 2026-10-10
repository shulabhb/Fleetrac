export type BreachSnapshot = {
  metricName?: string | null;
  latestObservedValue?: number | null;
  worstObservedValue?: number | null;
  thresholdValue?: number | null;
  thresholdOperator?: string | null;
  controlName?: string | null;
  controlId?: string | null;
  eventCount?: number | null;
};

export function formatObservedNumber(value: number): string {
  if (Math.abs(value) >= 10) return String(Math.round(value));
  return value.toFixed(3);
}

export function metricLabel(metricName: string): string {
  return metricName.replace(/_/g, " ");
}

/** Human-readable control breach. Does not claim the issue is fixed. */
export function formatMetricBreach(row: BreachSnapshot): string {
  if (!row.metricName) return "Control breach details are not on this risk yet.";
  const name = metricLabel(row.metricName);
  if (row.latestObservedValue == null || row.thresholdValue == null) {
    return `${row.controlName ?? name} breached. Observed value is not recorded yet.`;
  }
  const observed = formatObservedNumber(row.latestObservedValue);
  const threshold = formatObservedNumber(row.thresholdValue);
  const lowerIsWorse = row.thresholdOperator === "<" || row.thresholdOperator === "<=";
  if (lowerIsWorse) {
    return `${capitalize(name)} fell below the minimum: ${observed} observed vs ${threshold} required.`;
  }
  return `${capitalize(name)} exceeded threshold: ${observed} observed vs ${threshold} allowed.`;
}

export function impactExplanation(riskCategory: string): string {
  const category = riskCategory.toLowerCase();
  if (category.includes("cyber") || category.includes("security")) {
    return "Security impact: a tool or policy boundary was crossed. Containment stays approval-gated until verification.";
  }
  if (category.includes("output") || category.includes("model")) {
    return "Governance impact: output may be unsupported or weakly grounded. A reviewer should confirm it before it is treated as approved.";
  }
  if (category.includes("technology") || category.includes("reliab") || category.includes("latency")) {
    return "Reliability impact: degraded runtime can affect the requests this agent is serving. This is not yet a confirmed outage.";
  }
  return "Governance impact: a control threshold was crossed. The next step is an owner decision, not an automatic fix.";
}

export function evidenceSupportSentence(count: number): string {
  if (count <= 0) {
    return "No packaged evidence yet. Inspect telemetry; a control breach should attach a snapshot here.";
  }
  const noun = count === 1 ? "related event" : "related events";
  return `${count} ${noun} in the recent correlation window support this governance breach.`;
}

export function riskDetailCta(status: string, verificationStatus: string): string {
  const state = `${status} ${verificationStatus}`.toLowerCase();
  if (state.includes("rollback") || state.includes("regression")) return "Review rollback path";
  if (state.includes("improvement") || (state.includes("closed") && state.includes("improv"))) {
    return "View outcome evidence";
  }
  if (state.includes("no material") || state.includes("follow")) return "Review follow-up";
  if (state.includes("approved") || state.includes("monitoring") || state.includes("executed")) {
    return "Verify impact";
  }
  if (state.includes("awaiting") || state.includes("pending") || state.includes("not started")) {
    return "Review governed action";
  }
  return "Review governed action";
}

/** In-drawer destination for the primary CTA (tabs stay useful). */
export function riskDetailCtaTab(
  status: string,
  verificationStatus: string
): "decision" | "verification" | "evidence" {
  const label = riskDetailCta(status, verificationStatus);
  if (label === "View outcome evidence") return "evidence";
  if (label === "Review governed action") return "decision";
  return "verification";
}

export function verificationPendingCopy(hasAction: boolean, approved: boolean): string {
  if (!hasAction) return "Verification starts after a governed action is sent for approval.";
  if (!approved) return "Verification pending until the governed action is approved.";
  return "Verification pending after action approval.";
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
