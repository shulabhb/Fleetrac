/** Fleetrac Analysis summaries keyed by demo incident — single source for UI panels. */

export const FLEETRAC_ANALYSIS_BY_INCIDENT: Record<string, string> = {
  "inc-mrm-001":
    "Unsupported claim rate exceeded the approved threshold while retrieval confidence dropped below baseline. Fleetrac correlated groundedness evals with production invocation logs.",
  "inc-mrm-002":
    "Control deviation flagged against approved policy mapping; exception requires accountable owner sign-off before automated routing resumes.",
  "inc-mrm-003":
    "Groundedness evidence is stale on regulated FAQ paths; citation consistency below approved threshold.",
  "inc-mrm-004":
    "Gradual drift from approved baseline detected across retrieval window; confirmation needed before closure.",
  "inc-sec-001":
    "Agent attempted a restricted refund API tool call outside approved policy scope. Fleetrac traced agentic workflow span to policy violation.",
  "inc-sec-002":
    "Retry storm pattern may indicate runaway agent loop; containment recommended before customer impact.",
  "inc-plat-001":
    "Provider latency increased above baseline after routing change; fallback path did not meet SLO.",
  "inc-plat-002":
    "Rollback verification pending; post-execution metrics show partial recovery on primary route."
};

export function fleetracAnalysisForIncident(
  incidentId: string,
  fallback = "Fleetrac correlated live telemetry, eval signals, and policy checks for this incident."
): string {
  return FLEETRAC_ANALYSIS_BY_INCIDENT[incidentId] ?? fallback;
}
