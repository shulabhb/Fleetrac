/**
 * Demo live governance signals — runtime log / eval / policy posture (Observe).
 */

import { GOVERNED_SYSTEMS } from "@/lib/governance-dashboard-mock";

export type LiveSignalSeverity = "Critical" | "High" | "Medium" | "Low";

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
  systemName: string;
  ownerTeam: string;
  category: LiveSignalCategory;
  severity: LiveSignalSeverity;
  summary: string;
  detectedAt: string;
  /** Whether an incident record exists for this signal cluster */
  incidentLinked: boolean;
  incidentId?: string;
};

const SIGNAL_TEMPLATES: Array<{
  category: LiveSignalCategory;
  severity: LiveSignalSeverity;
  summary: string;
  incidentLinked?: boolean;
  incidentId?: string;
}> = [
  {
    category: "Grounding",
    severity: "Critical",
    summary: "Unsupported claim rate above approved threshold on retrieval window",
    incidentLinked: true,
    incidentId: "inc-mrm-001"
  },
  {
    category: "Drift",
    severity: "High",
    summary: "Model output distribution drift vs approved baseline (7d window)",
    incidentLinked: false
  },
  {
    category: "Policy",
    severity: "High",
    summary: "Agent tool invocation outside approved policy scope",
    incidentLinked: true,
    incidentId: "inc-sec-001"
  },
  {
    category: "Latency",
    severity: "Medium",
    summary: "P95 provider latency elevated after routing change",
    incidentLinked: true,
    incidentId: "inc-plat-001"
  },
  {
    category: "Security",
    severity: "High",
    summary: "Anomalous authentication pattern on workflow executor",
    incidentLinked: false
  },
  {
    category: "Cost",
    severity: "Low",
    summary: "Token spend spike on evaluation harness (within budget band)",
    incidentLinked: false
  }
];

/** Curated feed for Live Signals — aligned with dashboard governed systems. */
export function liveRuntimeSignals(): LiveRuntimeSignal[] {
  const systems = [...GOVERNED_SYSTEMS].sort(
    (a, b) => b.criticalIncidents - a.criticalIncidents || b.openIncidents - a.openIncidents
  );
  const rows: LiveRuntimeSignal[] = [];
  let i = 0;
  for (const sys of systems) {
    const tpl = SIGNAL_TEMPLATES[i % SIGNAL_TEMPLATES.length];
    rows.push({
      id: `sig-${sys.id}-${i}`,
      systemId: sys.id,
      systemName: sys.name,
      ownerTeam: sys.ownerTeam,
      category: tpl.category,
      severity: tpl.severity,
      summary: tpl.summary,
      detectedAt: sys.evidenceAge === "—" ? "12m ago" : `${sys.evidenceAge} ago`,
      incidentLinked: tpl.incidentLinked ?? false,
      incidentId: tpl.incidentId
    });
    i += 1;
    if (rows.length >= 12) break;
  }
  return rows;
}

export const LIVE_SIGNALS_SUMMARY = {
  active: 12,
  critical: 3,
  linkedIncidents: 3,
  systemsAffected: 8
};
