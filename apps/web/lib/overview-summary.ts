export type OverviewRisk = {
  systemId: string;
  severity: string;
  lifecycle: string;
};

export type OverviewModel = {
  id: string;
  openIncidents: number;
  status: "Critical" | "High" | "Medium" | "Low";
  ownerTeam: string;
};

const STATUS_RANK: Record<OverviewModel["status"], number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1
};

export function countDemoRisks(
  risks: OverviewRisk[],
  isDemo: (systemId: string) => boolean
): { active: number; criticalHigh: number } {
  const open = risks.filter(
    (risk) => isDemo(risk.systemId) && risk.lifecycle.toLowerCase() !== "closed"
  );
  const criticalHigh = open.filter((risk) => {
    const severity = risk.severity.toLowerCase();
    return severity === "critical" || severity === "high";
  }).length;
  return { active: open.length, criticalHigh };
}

export function verificationResultCount(input: {
  improved?: number;
  followUp?: number;
  rollback?: number;
}): number {
  return (input.improved ?? 0) + (input.followUp ?? 0) + (input.rollback ?? 0);
}

export function pickHighestPriorityModel<T extends OverviewModel>(models: T[]): T | undefined {
  return [...models].sort((a, b) => {
    const status = STATUS_RANK[b.status] - STATUS_RANK[a.status];
    if (status !== 0) return status;
    return b.openIncidents - a.openIncidents;
  })[0];
}

export type OverviewStepKind =
  | "governed_action"
  | "verify"
  | "rollback"
  | "follow_up"
  | "outcome"
  | "risk_detail"
  | "monitoring";

export type OverviewNextStep = {
  kind: OverviewStepKind;
  /** Button and table label */
  label: string;
  /** One sentence under the next-action heading */
  detail: string;
  /** Current workflow step, scanned above the loop */
  step: string;
};

export function overviewNextStep(input: {
  openIncidents?: number;
  lifecycle?: string | null;
  actionStatus?: string | null;
  verificationStatus?: string | null;
  incidentId?: string | null;
  bottleneck?: string | null;
}): OverviewNextStep {
  const verification = (input.verificationStatus ?? "").toLowerCase();
  const status = (input.actionStatus ?? "").toLowerCase();
  const lifecycle = (input.lifecycle ?? "").toLowerCase();
  const open = input.openIncidents ?? 0;
  const bottleneck = input.bottleneck?.trim() || "";

  if (
    verification.includes("rollback") ||
    verification.includes("regression") ||
    status.includes("rollback")
  ) {
    return {
      kind: "rollback",
      label: "Review rollback path",
      detail: "Verification recorded a rollback candidate.",
      step: "Rollback candidate"
    };
  }
  if (verification.includes("no material") || verification.includes("follow")) {
    return {
      kind: "follow_up",
      label: "Review follow-up",
      detail: "Verification recorded no material change.",
      step: "Verification"
    };
  }
  if (verification.includes("improvement")) {
    return {
      kind: "outcome",
      label: "View outcome evidence",
      detail: "Verification recorded improvement.",
      step: "Closed"
    };
  }
  if (
    status.includes("awaiting") ||
    status.includes("pending") ||
    lifecycle.includes("approval") ||
    lifecycle.includes("owner review")
  ) {
    return {
      kind: "governed_action",
      label: "Review governed action",
      detail: "A decision is waiting on this risk.",
      step: bottleneck || "Action Approval"
    };
  }
  if (
    status === "approved" ||
    status === "monitoring" ||
    status === "executed" ||
    lifecycle === "verification" ||
    lifecycle === "remediation"
  ) {
    return {
      kind: "verify",
      label: "Verify impact",
      detail: "The action is approved. Record the verification result.",
      step: "Verification"
    };
  }
  if (open > 0 || input.incidentId) {
    const id = input.incidentId?.trim();
    return {
      kind: "risk_detail",
      label: id ? `Review risk ${id}` : "Review risk detail",
      detail: "Open the risk to read the breach and the evidence.",
      step: bottleneck || "Owner Review"
    };
  }
  return {
    kind: "monitoring",
    label: "Monitoring",
    detail: "No threshold is breached for this owner.",
    step: "Monitoring"
  };
}

export function filterModels<T extends OverviewModel & { primaryRisk: string }>(
  models: T[],
  filters: { ownerTeam?: string; riskCategory?: string; severity?: string }
): T[] {
  return models.filter((model) => {
    if (filters.ownerTeam && model.ownerTeam !== filters.ownerTeam) return false;
    if (filters.riskCategory && model.primaryRisk !== filters.riskCategory) return false;
    if (filters.severity && model.status !== filters.severity) return false;
    return true;
  });
}
