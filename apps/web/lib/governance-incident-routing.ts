/**
 * Static incident → owner routing aligned with fleet registry pitch aliases.
 * Used by server route builders where governance API is unavailable.
 */

const ALIAS_OWNER_BY_PREFIX: Record<string, string> = {
  "inc-mrm": "Model Risk Management",
  "inc-sec": "Security Operations",
  "inc-plat": "Platform Reliability"
};

/** Known pitch alias → owner team (mirrors apps/api/app/fleet/registry.py). */
const KNOWN_INCIDENT_OWNERS: Record<string, string> = {
  "inc-mrm-001": "Model Risk Management",
  "inc-mrm-002": "Model Risk Management",
  "inc-sec-001": "Security Operations",
  "inc-sec-002": "Security Operations",
  "inc-plat-001": "Platform Reliability",
  "inc-plat-002": "Platform Reliability"
};

const SYSTEM_OWNER_BY_ID: Record<string, string> = {
  "sys-agt-treasury-001": "Model Risk Management",
  "sys-agt-pep-003": "Model Risk Management",
  "sys-agt-kyc-004": "Model Risk Management",
  "sys-agt-refund-001": "Model Risk Management",
  "sys-agt-cs-002": "Security Operations",
  "sys-agt-phish-008": "Security Operations",
  "sys-agt-inv-005": "Platform Reliability",
  "sys-agt-rag-007": "Platform Reliability"
};

export function findOwnerTeamForQueueIncident(incidentId: string): string | null {
  if (KNOWN_INCIDENT_OWNERS[incidentId]) {
    return KNOWN_INCIDENT_OWNERS[incidentId];
  }

  for (const [prefix, team] of Object.entries(ALIAS_OWNER_BY_PREFIX)) {
    if (incidentId.startsWith(`${prefix}-`)) return team;
  }

  if (incidentId.startsWith("inc_")) {
    const systemToken = incidentId.split("_")[1];
    if (systemToken && SYSTEM_OWNER_BY_ID[systemToken]) {
      return SYSTEM_OWNER_BY_ID[systemToken];
    }
  }

  return null;
}

export function isGovernanceQueueIncidentId(incidentId: string): boolean {
  return findOwnerTeamForQueueIncident(incidentId) != null;
}
