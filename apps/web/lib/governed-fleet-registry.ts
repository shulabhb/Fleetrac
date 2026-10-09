/**
 * Frontend demo fleet scope — runtime agent governance product focus.
 *
 * Backend registry still has 10 systems. Primary UI surfaces filter to these five.
 * Do not treat this as a backend deletion or simulator change.
 */

/** Canonical system IDs for the focused 5-agent demo fleet. */
export const DEMO_AGENT_IDS = [
  "sys-agt-treasury-001", // Treasury Commentary / M40 — flagship output reliability
  "sys-agt-phish-008", // Phishing Triage — flagship tool governance
  "sys-agt-cs-002", // Customer Support Routing / A12 — flagship provider degradation
  "sys-agt-rag-007", // Internal Knowledge RAG — healthy retrieval contrast
  "sys-agt-access-009" // Access Review — healthy security-adjacent contrast
] as const;

export type DemoAgentId = (typeof DEMO_AGENT_IDS)[number];

export const DEMO_AGENT_ID_SET: ReadonlySet<string> = new Set(DEMO_AGENT_IDS);

/** Primary UI fleet count (not backend registry size). */
export const GOVERNED_FLEET_SYSTEM_COUNT = DEMO_AGENT_IDS.length;

export const GOVERNED_FLEET_SYSTEMS_SUB =
  "5 governed agents · runtime governance focus";

export function isDemoAgent(systemId: string | null | undefined): boolean {
  if (!systemId) return false;
  return DEMO_AGENT_ID_SET.has(systemId);
}

export function filterDemoAgents<T extends { system_id?: string; systemId?: string }>(
  items: T[]
): T[] {
  return items.filter((item) => {
    const id = item.system_id ?? item.systemId;
    return isDemoAgent(id);
  });
}

/** Prefer DEMO_AGENT_IDS order when listing agents. */
export function sortDemoAgentsFirst<T extends { system_id?: string; systemId?: string }>(
  items: T[]
): T[] {
  const order = new Map(DEMO_AGENT_IDS.map((id, index) => [id, index]));
  return [...items].sort((a, b) => {
    const ai = order.get((a.system_id ?? a.systemId) as DemoAgentId) ?? 999;
    const bi = order.get((b.system_id ?? b.systemId) as DemoAgentId) ?? 999;
    return ai - bi;
  });
}

/** Resolve display id (e.g. M40) to canonical system id when only display is known. */
export function canonicalSystemIdForDisplay(displayId: string): string {
  return displayId;
}

/**
 * Flagship risk aliases for the three demo pitch stories (frontend navigation only).
 * Backend pitch aliases remain the source of truth when events exist.
 */
export const FLAGSHIP_RISK_BY_SYSTEM: Record<string, string> = {
  "sys-agt-treasury-001": "inc-mrm-001",
  "sys-agt-phish-008": "inc-sec-001",
  "sys-agt-cs-002": "inc-plat-003"
};

export function flagshipRiskForSystem(
  systemId: string | null | undefined
): string | null {
  if (!systemId) return null;
  return FLAGSHIP_RISK_BY_SYSTEM[systemId] ?? null;
}
