/**
 * Session-backed demo actions from Incident Queue and Evidence Library.
 * Merged into Action Center pending inbox; deduped by incidentId.
 */

export type DemoActionCenterSource = "Incident Queue" | "Evidence Library";

export type DemoWorkflowStatus = "Awaiting approval" | "Approved" | "Rejected";

export type DemoVerificationStatus =
  | "Not started"
  | "Awaiting measurement"
  | "Complete";

export type DemoWorkflowActionItem = {
  source: DemoActionCenterSource;
  incidentId: string;
  incidentTitle: string;
  ownerTeam: string;
  assignedTo?: string;
  systemName?: string;
  riskCategory?: string;
  severity?: string;
  recommendedAction?: string;
  status: DemoWorkflowStatus;
  verificationStatus: DemoVerificationStatus;
  createdAt: number;
  decidedAt?: number;
};

export function demoSelectionId(incidentId: string): string {
  return `demo:${incidentId}`;
}

export function parseDemoSelectionId(id: string): string | null {
  return id.startsWith("demo:") ? id.slice(5) : null;
}

export function apiSelectionId(actionId: string): string {
  return `api:${actionId}`;
}

export function parseApiSelectionId(id: string): string | null {
  return id.startsWith("api:") ? id.slice(4) : null;
}

export function isDemoHighRisk(severity?: string): boolean {
  const s = severity?.toLowerCase() ?? "";
  return s.includes("critical") || s.includes("high");
}

export function demoSeverityToRisk(severity?: string): "low" | "medium" | "high" {
  if (isDemoHighRisk(severity)) return "high";
  if (severity?.toLowerCase().includes("medium")) return "medium";
  return "low";
}

const STORAGE_KEY = "fleetrac-mock-action-center-items";

export type PushDemoWorkflowActionInput = {
  source: DemoActionCenterSource;
  incidentId: string;
  incidentTitle: string;
  ownerTeam: string;
  assignedTo?: string;
  systemName?: string;
  riskCategory?: string;
  severity?: string;
  recommendedAction?: string;
  status?: string;
  verificationStatus?: string;
};

export function readDemoWorkflowActions(): DemoWorkflowActionItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DemoWorkflowActionItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function pushDemoWorkflowAction(input: PushDemoWorkflowActionInput): void {
  if (typeof window === "undefined") return;
  const next: DemoWorkflowActionItem = {
    source: input.source,
    incidentId: input.incidentId,
    incidentTitle: input.incidentTitle,
    ownerTeam: input.ownerTeam,
    assignedTo: input.assignedTo,
    systemName: input.systemName,
    riskCategory: input.riskCategory,
    severity: input.severity,
    recommendedAction: input.recommendedAction,
    status: (input.status as DemoWorkflowStatus) ?? "Awaiting approval",
    verificationStatus:
      (input.verificationStatus as DemoVerificationStatus) ?? "Not started",
    createdAt: Date.now()
  };
  const list = readDemoWorkflowActions().filter((i) => i.incidentId !== input.incidentId);
  list.push(next);
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota */
  }
  window.dispatchEvent(new Event("fleetrac-demo-actions-updated"));
}

function persistDemoList(list: DemoWorkflowActionItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event("fleetrac-demo-actions-updated"));
}

export function updateDemoWorkflowAction(
  incidentId: string,
  patch: Partial<
    Pick<
      DemoWorkflowActionItem,
      "status" | "verificationStatus" | "decidedAt"
    >
  >
): void {
  if (typeof window === "undefined") return;
  const list = readDemoWorkflowActions();
  const idx = list.findIndex((i) => i.incidentId === incidentId);
  if (idx < 0) return;
  list[idx] = { ...list[idx], ...patch };
  persistDemoList(list);
}

export function approveDemoWorkflowAction(incidentId: string): void {
  updateDemoWorkflowAction(incidentId, {
    status: "Approved",
    verificationStatus: "Awaiting measurement",
    decidedAt: Date.now()
  });
}

export function rejectDemoWorkflowAction(incidentId: string): void {
  updateDemoWorkflowAction(incidentId, {
    status: "Rejected",
    verificationStatus: "Not started",
    decidedAt: Date.now()
  });
}

/** @deprecated Use pushDemoWorkflowAction — kept for existing imports */
export type MockActionCenterItem = DemoWorkflowActionItem;

/** @deprecated Use pushDemoWorkflowAction */
export function pushMockActionCenterItem(item: {
  incidentId: string;
  title: string;
  ownerTeam: string;
  source?: string;
  assignedTo?: string;
  recommendedAction?: string;
  status?: string;
  systemName?: string;
  riskCategory?: string;
  severity?: string;
  verificationStatus?: string;
}): void {
  const source =
    item.source === "Evidence Library" ? "Evidence Library" : "Incident Queue";
  pushDemoWorkflowAction({
    source,
    incidentId: item.incidentId,
    incidentTitle: item.title,
    ownerTeam: item.ownerTeam,
    assignedTo: item.assignedTo,
    systemName: item.systemName,
    riskCategory: item.riskCategory,
    severity: item.severity,
    recommendedAction: item.recommendedAction,
    status: item.status,
    verificationStatus: item.verificationStatus
  });
}
