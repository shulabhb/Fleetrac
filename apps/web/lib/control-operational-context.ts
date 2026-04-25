import { riskDomainFromCategory, signalTypeForField } from "@/lib/present";

export type ControlHealthTone = "ok" | "warn" | "urgent" | "neutral" | "info";

export type ControlOperationalSnapshot = {
  ruleId: string;
  ruleName: string;
  ruleDescription: string;
  severity: string;
  signal: string;
  risk: string;
  ownerTeam: string;
  comparator: string;
  thresholdField: string;
  observedField: string;
  enabled: boolean;
  lastTriggeredAt: string | null;
  systemsCovered7d: number;
  incidents7d: number;
  incidents30d: number;
  totalFires: number;
  openIncidents: number;
  recurring7d: boolean;
  isQuiet7d: boolean;
  bobFlagged: boolean;
  activeNow: boolean;
  escalationRate7d: number;
  reviewBurden7d: number;
  /** 7 integers, oldest → newest day in window */
  firesByDay7: number[];
  /** 14 integers for sparkline when 7d is flat */
  firesByDay14: number[];
  projectionLow: number;
  projectionHigh: number;
  verdictSentence: string;
  verdictTone: ControlHealthTone;
  verdictChips: string[];
  recommendedSummary: string;
  fleetSystems: Array<{
    systemId: string;
    systemName: string;
    fires7d: number;
    escalated: number;
  }>;
  latestIncidents: any[];
  openIncidentsList: any[];
};

function startOfUtcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function bucketFiresByDay(
  incidents: any[],
  days: number,
  nowMs: number
): number[] {
  const buckets = Array.from({ length: days }, () => 0);
  const dayMs = 24 * 60 * 60 * 1000;
  const endDay = startOfUtcDay(new Date(nowMs));
  for (const inc of incidents) {
    const t = new Date(inc.created_at).getTime();
    if (t > nowMs || nowMs - t > days * dayMs) continue;
    const dayStart = startOfUtcDay(new Date(t));
    const idx = Math.floor((endDay - dayStart) / dayMs);
    if (idx >= 0 && idx < days) buckets[days - 1 - idx] += 1;
  }
  return buckets;
}

export function buildControlOperationalSnapshot(
  rule: any,
  allIncidents: any[]
): ControlOperationalSnapshot {
  const nowMs = Date.now();
  const ms7d = 7 * 24 * 60 * 60 * 1000;
  const ms30d = 30 * 24 * 60 * 60 * 1000;

  const triggered = (allIncidents ?? [])
    .filter((i: any) => i.rule_id === rule.id)
    .sort(
      (a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  const recent7 = triggered.filter(
    (i: any) => nowMs - new Date(i.created_at).getTime() <= ms7d
  );
  const recent30 = triggered.filter(
    (i: any) => nowMs - new Date(i.created_at).getTime() <= ms30d
  );

  const systems7 = new Set(recent7.map((i: any) => i.system_id));
  const openList = triggered.filter(
    (i: any) => i.incident_status !== "closed"
  );
  const escalated7 = recent7.filter(
    (i: any) => i.escalation_status === "escalated"
  ).length;
  const review7 = recent7.filter((i: any) => i.review_required).length;

  const lastTriggeredAt = triggered[0]?.created_at ?? null;
  const ownerTeam =
    triggered[0]?.owner_team ?? "Governance Operations";

  const signal = signalTypeForField(rule.observed_field);
  const risk = riskDomainFromCategory(rule.category);

  const recurring7d = recent7.length >= 3;
  const isQuiet7d = recent7.length === 0;
  const activeNow = recent7.length > 0;

  const firesByDay7 = bucketFiresByDay(recent7, 7, nowMs);
  const firesByDay14 = bucketFiresByDay(recent30, 14, nowMs);

  const base = recent7.length;
  const projectionLow = isQuiet7d
    ? 0
    : Math.max(1, Math.floor(base * 0.85));
  const projectionHigh = isQuiet7d
    ? 1
    : Math.max(projectionLow, Math.ceil(base * 1.35));

  const verdictChips: string[] = [];
  let verdictTone: ControlHealthTone = "neutral";
  let verdictSentence =
    "Insufficient recent signal in the 7-day window to classify burden or calibration drift.";

  if (isQuiet7d) {
    verdictTone = "ok";
    verdictSentence =
      "Quiet in the last 7 days. Coverage still applies; validate that upstream telemetry remains connected.";
    verdictChips.push("Quiet window");
  } else if (recurring7d && systems7.size >= 4) {
    verdictTone = "warn";
    verdictSentence = `Recurring and possibly over-sensitive. This control fired ${recent7.length} time${recent7.length === 1 ? "" : "s"} across ${systems7.size} systems in the last 7 days. Bob or reviewers should assess threshold tuning, routing, or control splitting before burden compounds.`;
    verdictChips.push("Recurring pattern");
    if (review7 >= recent7.length * 0.5) verdictChips.push("High reviewer burden");
    verdictChips.push("Needs tuning");
    if (escalated7 > 0) verdictChips.push("Approval-gated change may be required");
  } else if (recent7.length >= 1 && systems7.size <= 1) {
    verdictTone = "info";
    verdictSentence = `Active but geographically narrow: ${recent7.length} fire${recent7.length === 1 ? "" : "s"} in 7d concentrated on fewer systems. Confirm whether coverage is intentionally narrow or under-detecting fleet variance.`;
    verdictChips.push("Narrow blast radius");
    if (escalated7 > 0) verdictChips.push("Escalations present");
  } else {
    verdictTone = "info";
    verdictSentence = `Operating within a moderate band: ${recent7.length} incident${recent7.length === 1 ? "" : "s"} in 7d across ${systems7.size} systems. Watch recurrence and escalation rate against reviewer capacity.`;
    if (recurring7d) verdictChips.push("Recurring pattern");
    if (review7 >= 3) verdictChips.push("Reviewer load");
    if (escalated7 > 0) verdictChips.push("Escalations");
  }

  const bySys: Record<
    string,
    { systemId: string; systemName: string; fires7d: number; escalated: number }
  > = {};
  for (const inc of recent7) {
    const sid = inc.system_id;
    if (!bySys[sid]) {
      bySys[sid] = {
        systemId: sid,
        systemName: inc.system_name ?? sid,
        fires7d: 0,
        escalated: 0
      };
    }
    bySys[sid].fires7d += 1;
    if (inc.escalation_status === "escalated") bySys[sid].escalated += 1;
  }
  const fleetSystems = Object.values(bySys).sort(
    (a, b) => b.fires7d - a.fires7d || b.escalated - a.escalated
  );

  const latestIncidents = triggered.slice(0, 8);
  const openIncidentsList = openList.slice(0, 8);

  const lastRec =
    triggered[0]?.recommended_action ??
    "Review control calibration with the owning team when workload allows.";

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    ruleDescription: rule.description ?? "",
    severity: rule.severity,
    signal,
    risk,
    ownerTeam,
    comparator: rule.comparator,
    thresholdField: rule.threshold_field,
    observedField: rule.observed_field,
    enabled: rule.enabled !== false,
    lastTriggeredAt,
    systemsCovered7d: systems7.size,
    incidents7d: recent7.length,
    incidents30d: recent30.length,
    totalFires: triggered.length,
    openIncidents: openList.length,
    recurring7d,
    isQuiet7d,
    bobFlagged: false,
    activeNow,
    escalationRate7d:
      recent7.length > 0 ? escalated7 / recent7.length : 0,
    reviewBurden7d: review7,
    firesByDay7,
    firesByDay14,
    projectionLow,
    projectionHigh,
    verdictSentence,
    verdictTone,
    verdictChips: verdictChips.slice(0, 4),
    recommendedSummary: lastRec,
    fleetSystems,
    latestIncidents,
    openIncidentsList
  };
}

export function mergeBobIntoSnapshot(
  snap: ControlOperationalSnapshot,
  bob: any | null
): ControlOperationalSnapshot {
  if (!bob) return snap;
  const chips = [...snap.verdictChips];
  if (!chips.some((c) => c.toLowerCase().includes("bob")))
    chips.unshift("Bob flagged");
  return {
    ...snap,
    bobFlagged: true,
    verdictChips: chips.slice(0, 4),
    verdictTone: snap.verdictTone === "ok" ? "warn" : snap.verdictTone,
    verdictSentence: snap.isQuiet7d
      ? `Bob flagged this control while the 7-day fire window is quiet — review calibration, routing, or dormant dependencies. ${bob.summary ?? ""}`.trim()
      : `${snap.verdictSentence} Bob: ${bob.summary ?? "Review bounded investigation for tuning guidance."}`.trim()
  };
}
