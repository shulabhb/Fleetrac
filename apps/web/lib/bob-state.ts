import type { ApprovalStatus, InvestigationStatus } from "./bob-types";

export type BobInvestigationOverride = {
  status?: InvestigationStatus;
  note?: string;
  updatedAt?: string;
};

export type BobRecommendationOverride = {
  approvalStatus?: ApprovalStatus;
  updatedAt?: string;
};

export type BobDemoState = {
  investigations: Record<string, BobInvestigationOverride>;
  recommendations: Record<string, BobRecommendationOverride>;
};

const STORAGE_KEY = "fleetrac_demo_bob_state_v1";

const EMPTY: BobDemoState = { investigations: {}, recommendations: {} };

export function readBobState(): BobDemoState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as BobDemoState;
    return {
      investigations: parsed.investigations ?? {},
      recommendations: parsed.recommendations ?? {}
    };
  } catch {
    return EMPTY;
  }
}

export function writeBobState(state: BobDemoState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function setInvestigationOverride(
  id: string,
  override: BobInvestigationOverride
) {
  const state = readBobState();
  state.investigations[id] = {
    ...state.investigations[id],
    ...override,
    updatedAt: new Date().toISOString()
  };
  writeBobState(state);
}

export function setRecommendationOverride(
  id: string,
  override: BobRecommendationOverride
) {
  const state = readBobState();
  state.recommendations[id] = {
    ...state.recommendations[id],
    ...override,
    updatedAt: new Date().toISOString()
  };
  writeBobState(state);
}

export function resetBobState() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
