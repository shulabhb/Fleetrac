export type DemoIncidentState = {
  incidentStatus: string;
  escalationStatus: string;
  reviewRequired: boolean;
};

const STORAGE_KEY = "fleetrac_demo_incident_state_v1";

export function readDemoState(): Record<string, DemoIncidentState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function writeDemoState(state: Record<string, DemoIncidentState>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function setIncidentDemoState(incidentId: string, state: DemoIncidentState) {
  const current = readDemoState();
  current[incidentId] = state;
  writeDemoState(current);
}

export function resetDemoState() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
