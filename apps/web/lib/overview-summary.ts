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

/** Loop tab that matches the CTA wording — never Summary / analysis. */
export type OverviewLoopTab = "decision" | "verification" | "evidence" | "history";

export function drawerTabForOverviewStep(kind: OverviewStepKind): OverviewLoopTab {
  switch (kind) {
    case "governed_action":
      return "decision";
    case "verify":
    case "rollback":
    case "follow_up":
      return "verification";
    case "outcome":
      return "evidence";
    case "risk_detail":
      return "evidence";
    default:
      return "history";
  }
}

export function drawerTabForNotificationKind(kind: string | null | undefined): OverviewLoopTab {
  switch (kind) {
    case "decision":
      return "decision";
    case "verify":
    case "rollback":
    case "follow_up":
    case "regression":
      return "verification";
    case "improvement":
      return "evidence";
    default:
      return "history";
  }
}

export type OverviewCtaSurface = "risk_detail" | "action_center" | "outcomes_audit";

export function overviewStepKindFromNotification(
  kind: string | null | undefined
): OverviewStepKind {
  switch (kind) {
    case "decision":
      return "governed_action";
    case "verify":
      return "verify";
    case "rollback":
    case "regression":
      return "rollback";
    case "follow_up":
      return "follow_up";
    case "improvement":
      return "outcome";
    default:
      return "risk_detail";
  }
}

/** Overview CTAs: Risk Detail only for fresh / owner / evidence review. */
export function overviewCtaSurface(kind: OverviewStepKind): OverviewCtaSurface {
  switch (kind) {
    case "governed_action":
    case "verify":
    case "rollback":
    case "follow_up":
      return "action_center";
    case "outcome":
      return "outcomes_audit";
    default:
      return "risk_detail";
  }
}

export function actionCenterTabForOverviewStep(
  kind: OverviewStepKind
): "pending" | "ready" | "closed" {
  if (kind === "governed_action") return "pending";
  if (kind === "verify") return "ready";
  return "closed";
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
