const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:8000";
const API_PREFIX = "/api/v1";

export const SLICE_A_SYSTEM_DISPLAY_ID = "M40";
export const SLICE_A_INCIDENT_ALIAS = "inc-mrm-001";
export const SLICE_A_INCIDENT_CANONICAL =
  "inc_sys-agt-treasury-001_unsupported_claim_001";
export const SLICE_A_OWNER_TEAM = "Model Risk Management";

export const PRIMARY_OWNER_TEAMS = [
  "Model Risk Management",
  "Security Operations",
  "Platform Reliability"
] as const;

export type FleetracAnalysisDTO = {
  incident_id: string;
  alias_id: string;
  summary: string;
  bounded_scope: string;
  recommended_actions: string[];
  evidence_highlights: string[];
  policy_notes: string;
  confidence: number;
  diagnosis?: string;
  current_severity?: string;
  assessment_confidence?: string;
  why_this_severity?: string[];
  why_not_higher?: string[];
  occurrence_count?: number;
  trace_count?: number;
  recommended_bounded_action?: string;
};

export type LiveSignalRowDTO = {
  id: string;
  alias_id: string | null;
  system_id: string;
  display_system_id: string;
  system_name: string;
  system_name_alias: string | null;
  event_id: string;
  timestamp: string;
  operation_type: string;
  normalized_signal_type: string | null;
  signal_state?: string;
  severity: string | null;
  confidence: number | null;
  incident_id: string | null;
  trace_id: string | null;
  span_id?: string | null;
  parent_span_id?: string | null;
  latency_ms?: number | null;
  evaluation_signals?: Record<string, unknown>;
  owner_team?: string | null;
  source_type?: string | null;
  source_provider?: string | null;
  model?: string | null;
};

export type LiveSignalsResponseDTO = {
  items: LiveSignalRowDTO[];
  total: number;
};

export type IngestLogNormalizedDTO = {
  event_id: string;
  timestamp: string;
  source_provider: string;
  source_type: string;
  operation_type: string;
  model?: string | null;
  severity: string;
  normalized_signal_type?: string | null;
  incident_id?: string | null;
  trace_id?: string | null;
  span_id?: string | null;
  latency_ms?: number | null;
  evaluation_signals?: Record<string, unknown>;
};

export type IngestLogRowDTO = {
  raw_event_id: string;
  ingested_at: string;
  system_id: string;
  display_system_id: string;
  system_name: string;
  idempotency_key: string;
  payload_hash: string;
  source_type: string;
  raw_payload: Record<string, unknown>;
  normalized?: IngestLogNormalizedDTO | null;
  normalized_spans?: IngestLogNormalizedDTO[];
};

export type IngestLogResponseDTO = {
  items: IngestLogRowDTO[];
  total: number;
};

export type OwnerQueueRowDTO = {
  id: string;
  alias_id: string | null;
  system_id: string;
  display_system_id: string;
  system_name: string;
  system_name_alias: string | null;
  lifecycle: string;
  classification_category: string;
  severity: string;
  priority: string;
  owner_team: string;
  accountable_owner_team?: string;
  responder_team?: string;
  title: string;
  summary: string;
  reviewer: string | null;
  opened_at: string;
  updated_at: string;
  diagnosis_family?: string | null;
  severity_reason?: string | null;
  assessment_confidence?: number | null;
  occurrence_count?: number | null;
  trace_count?: number | null;
  highest_severity?: string | null;
  /** Phase G — runtime breach snapshot */
  rule_id?: string | null;
  control_name?: string | null;
  metric_name?: string | null;
  threshold_value?: number | null;
  threshold_operator?: string | null;
  latest_observed_value?: number | null;
  worst_observed_value?: number | null;
  recommended_next_step?: string | null;
  trigger_event_id?: string | null;
  last_seen_at?: string | null;
  signal_type?: string | null;
};

export type SeverityHistoryItemDTO = {
  id: string;
  previous_severity: string;
  new_severity: string;
  score: number;
  reason: string;
  assessment_id: string;
  changed_at: string;
};

export type SeverityHistoryResponseDTO = {
  items: SeverityHistoryItemDTO[];
  total: number;
};

export type OwnerQueueResponseDTO = {
  items: OwnerQueueRowDTO[];
  total: number;
};

export type GovernanceSystemDTO = {
  system_id: string;
  display_system_id: string;
  system_name: string;
  system_name_alias: string | null;
  owner_team: string;
  platform: string;
  archetype: string;
  open_incidents: number;
  last_signal_at: string | null;
};

export type GovernanceSystemsResponseDTO = {
  items: GovernanceSystemDTO[];
  total: number;
};

export type SimulatorScenarioDTO = {
  id: string;
  status: string;
  eligible_archetypes: string[];
  eligible_systems: string[];
  expected_incident: boolean;
};

export type SimulatorScenariosResponseDTO = {
  implemented: SimulatorScenarioDTO[];
  planned: SimulatorScenarioDTO[];
};

export type EvidenceItemDTO = {
  id: string;
  kind: string;
  reference_id: string;
  summary: string;
  created_at: string;
  trace_id?: string | null;
  span_id?: string | null;
  operation_type?: string | null;
  evaluation_signals?: Record<string, unknown>;
};

export type EvidenceRecordDTO = {
  id: string;
  alias_id: string | null;
  system_id: string;
  display_system_id: string;
  system_name: string;
  system_name_alias: string | null;
  incident_id: string;
  status: string;
  packaged_at: string;
  owner_team?: string | null;
  title?: string | null;
  severity?: string | null;
  lifecycle?: string | null;
  classification_category?: string | null;
  reviewer?: string | null;
  items: EvidenceItemDTO[];
  fleetrac_analysis: FleetracAnalysisDTO;
  lifecycle_history: Record<string, unknown>[];
};

export type EvidenceLibraryItemDTO = {
  incident_id: string;
  alias_id: string | null;
  title: string;
  lifecycle: string;
  owner_team: string;
  evidence_items_count: number;
  display_system_id: string;
  system_name: string;
  system_name_alias: string | null;
  verification_outcome?: string | null;
  verification_summary?: string | null;
  verification_metric?: string | null;
  verification_baseline?: number | null;
  verification_post_action?: number | null;
};

export type EvidenceLibraryResponseDTO = {
  items: EvidenceLibraryItemDTO[];
  total: number;
};

export type DashboardSummaryDTO = {
  active_incidents: number;
  critical_incidents: number;
  decisions_needed: number;
  verification_count: number;
  actions_awaiting_approval: number;
  verification_improved: number;
  verification_follow_up: number;
  verification_rollback: number;
  owner_open_counts: Record<string, number>;
};

export type GovernanceSystemDetailDTO = GovernanceSystemDTO & {
  team_lead: string;
  default_reviewer: string;
  description: string;
  business_function: string;
  data_sensitivity: string;
  cloud_provider: string;
  cloud_region: string;
  approved_model_name: string;
  approved_tools: string[];
  blocked_tools: string[];
  baseline_metrics: Record<string, number>;
  applicable_control_ids: string[];
};

export type SystemIncidentDTO = {
  id: string;
  alias_id: string | null;
  system_id: string;
  display_system_id: string;
  system_name: string;
  system_name_alias: string | null;
  lifecycle: string;
  severity: string;
  priority: string;
  title: string;
  summary: string;
  signal_type: string;
  opened_at: string;
  updated_at: string;
};

export type SystemTelemetryPointDTO = {
  timestamp: string;
  latency_ms: number | null;
  grounding_score: number | null;
  unsupported_claim_rate: number | null;
  signal_type: string | null;
  severity: string | null;
};

export type SystemControlDTO = {
  rule_id: string;
  signal_type: string;
  threshold_field: string;
  threshold_value: number;
  severity: string;
  last_fired_at: string | null;
  open_incident_id: string | null;
};

export type GovernedActionDTO = {
  id: string;
  incident_id: string;
  alias_id: string | null;
  title: string;
  owner_team: string;
  system_id?: string;
  system_name: string;
  risk_category: string;
  severity: string;
  execution_mode: string;
  status: string;
  verification_status: string;
  recommended_action: string;
  assigned_to?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  action_type?: string | null;
  expected_metric?: string | null;
  expected_direction?: string | null;
  rollback_eligible?: boolean;
  expected_result?: string | null;
  resolution_status?: string | null;
  resolution_note?: string | null;
  resolution_recorded_at?: string | null;
  resolution_recorded_by?: string | null;
};

export const GOVERNANCE_UPDATED_EVENT = "fleetrac-governance-updated";

export function notifyGovernanceUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(GOVERNANCE_UPDATED_EVENT));
}

export type NotificationDTO = {
  id: string;
  incident_id: string;
  alias_id?: string | null;
  owner_team?: string | null;
  channel: string;
  recipient: string;
  status: string;
  message: string;
  kind?: string | null;
  target?: string | null;
  action_id?: string | null;
  created_at: string;
};

export type SimulatorStatusDTO = {
  running: boolean;
  mode: string;
  rate_eps: number | null;
  last_scenario: string | null;
  event_count: number;
  incident_id: string | null;
  last_error: string | null;
};

async function governanceFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE_URL}${API_PREFIX}${path}`, {
      cache: "no-store"
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function governancePost<T>(path: string, body?: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE_URL}${API_PREFIX}${path}`, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store"
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function governanceEventsStreamUrl(): string {
  return `${API_BASE_URL}${API_PREFIX}/events/stream`;
}

export async function fetchLiveSignals(limit = 50): Promise<LiveSignalsResponseDTO | null> {
  return governanceFetch<LiveSignalsResponseDTO>(
    `/governance/live-signals?limit=${limit}`
  );
}

export async function fetchIngestLog(
  limit = 50,
  systemId?: string,
  since?: string
): Promise<IngestLogResponseDTO | null> {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (systemId) qs.set("system_id", systemId);
  if (since) qs.set("since", since);
  return governanceFetch<IngestLogResponseDTO>(`/governance/ingest-log?${qs}`);
}

export async function fetchOwnerQueue(
  ownerTeam: string
): Promise<OwnerQueueResponseDTO | null> {
  const qs = new URLSearchParams({ owner_team: ownerTeam });
  return governanceFetch<OwnerQueueResponseDTO>(`/governance/owner-queue?${qs}`);
}

export async function fetchEvidence(
  incidentId: string
): Promise<EvidenceRecordDTO | null> {
  return governanceFetch<EvidenceRecordDTO>(
    `/governance/evidence/${encodeURIComponent(incidentId)}`
  );
}

export async function fetchSeverityHistory(
  incidentId: string
): Promise<SeverityHistoryResponseDTO | null> {
  return governanceFetch<SeverityHistoryResponseDTO>(
    `/governance/incidents/${encodeURIComponent(incidentId)}/severity-history`
  );
}

export async function fetchEvidenceLibrary(
  ownerTeam?: string
): Promise<EvidenceLibraryResponseDTO | null> {
  const qs = ownerTeam
    ? new URLSearchParams({ owner_team: ownerTeam })
    : null;
  const path = qs
    ? `/governance/evidence-library?${qs}`
    : "/governance/evidence-library";
  return governanceFetch<EvidenceLibraryResponseDTO>(path);
}

export async function fetchNotifications(
  limit = 50
): Promise<{ items: NotificationDTO[] } | null> {
  return governanceFetch<{ items: NotificationDTO[] }>(
    `/governance/notifications?limit=${limit}`
  );
}

export async function fetchDashboardSummary(): Promise<DashboardSummaryDTO | null> {
  return governanceFetch<DashboardSummaryDTO>("/governance/dashboard-summary");
}

export async function fetchGovernedActions(): Promise<{ items: GovernedActionDTO[] } | null> {
  return governanceFetch<{ items: GovernedActionDTO[] }>("/governance/actions");
}

export async function fetchSimulatorStatus(): Promise<SimulatorStatusDTO | null> {
  return governanceFetch<SimulatorStatusDTO>("/simulator/status");
}

export async function postSimulatorReset(): Promise<void> {
  await governancePost("/simulator/reset");
}

export async function fetchGovernanceSystemDetail(
  systemId: string
): Promise<GovernanceSystemDetailDTO | null> {
  return governanceFetch<GovernanceSystemDetailDTO>(
    `/governance/systems/${encodeURIComponent(systemId)}`
  );
}

export async function fetchSystemIncidents(
  systemId: string
): Promise<{ items: SystemIncidentDTO[]; total: number } | null> {
  return governanceFetch<{ items: SystemIncidentDTO[]; total: number }>(
    `/governance/systems/${encodeURIComponent(systemId)}/incidents`
  );
}

export async function fetchSystemSignals(
  systemId: string,
  limit = 50
): Promise<LiveSignalsResponseDTO | null> {
  return governanceFetch<LiveSignalsResponseDTO>(
    `/governance/systems/${encodeURIComponent(systemId)}/signals?limit=${limit}`
  );
}

export async function fetchSystemTelemetry(
  systemId: string,
  limit = 120
): Promise<{ items: SystemTelemetryPointDTO[]; total: number } | null> {
  return governanceFetch<{ items: SystemTelemetryPointDTO[]; total: number }>(
    `/governance/systems/${encodeURIComponent(systemId)}/telemetry?limit=${limit}`
  );
}

export async function fetchSystemControls(
  systemId: string
): Promise<{ items: SystemControlDTO[]; total: number } | null> {
  return governanceFetch<{ items: SystemControlDTO[]; total: number }>(
    `/governance/systems/${encodeURIComponent(systemId)}/controls`
  );
}

export async function fetchGovernanceSystems(): Promise<GovernanceSystemsResponseDTO | null> {
  return governanceFetch<GovernanceSystemsResponseDTO>("/governance/systems");
}

export async function fetchSimulatorScenarios(): Promise<SimulatorScenariosResponseDTO | null> {
  return governanceFetch<SimulatorScenariosResponseDTO>("/simulator/scenarios");
}

export async function postSimulatorStart(opts?: {
  rate_eps?: number;
  systems?: string[];
  seed?: number;
}): Promise<void> {
  await governancePost("/simulator/start", {
    mode: "continuous",
    rate_eps: opts?.rate_eps ?? 5,
    systems: opts?.systems,
    seed: opts?.seed ?? 42
  });
}

export async function postSimulatorStop(): Promise<void> {
  await governancePost("/simulator/stop");
}

export async function postSimulatorPause(): Promise<void> {
  await governancePost("/simulator/pause");
}

export async function postScenario(
  scenarioId: string,
  systemId?: string
): Promise<{ posted: number; incident_id?: string } | null> {
  return governancePost(`/simulator/scenarios/${scenarioId}`, {
    system_id: systemId ?? "sys-agt-treasury-001"
  });
}

export async function postPitch(pitchId: string): Promise<unknown> {
  return governancePost(`/simulator/pitch/${pitchId}`);
}

export async function postCreateAction(
  incidentId: string,
  executionMode = "approval_required"
): Promise<{ action_id: string } | null> {
  return governancePost(`/governance/incidents/${encodeURIComponent(incidentId)}/actions`, {
    execution_mode: executionMode
  });
}

export async function handoffIncidentToActionCenter(
  incidentId: string,
  executionMode = "approval_required"
): Promise<string | null> {
  const result = await postCreateAction(incidentId, executionMode);
  if (!result?.action_id) return null;
  notifyGovernanceUpdated();
  return result.action_id;
}

export async function postApproveAction(
  actionId: string
): Promise<{ action_id: string; status: string } | null> {
  const result = await governancePost<{ action_id: string; status: string }>(
    `/governance/actions/${encodeURIComponent(actionId)}/approve`
  );
  if (result) notifyGovernanceUpdated();
  return result;
}

export async function postRejectAction(
  actionId: string
): Promise<{ action_id: string; status: string } | null> {
  const result = await governancePost<{ action_id: string; status: string }>(
    `/governance/actions/${encodeURIComponent(actionId)}/reject`
  );
  if (result) notifyGovernanceUpdated();
  return result;
}

export async function postVerifyAction(
  actionId: string,
  outcome: string,
  summary?: string
): Promise<unknown> {
  const result = await governancePost(`/governance/actions/${actionId}/verify`, {
    outcome,
    summary: summary ?? ""
  });
  if (result) notifyGovernanceUpdated();
  return result;
}

export async function postResolveAction(
  actionId: string,
  resolutionStatus: string,
  note?: string
): Promise<{
  action_id: string;
  status: string;
  resolution_status: string;
  resolution_note: string | null;
  incident_lifecycle: string | null;
} | null> {
  const result = await governancePost<{
    action_id: string;
    status: string;
    resolution_status: string;
    resolution_note: string | null;
    incident_lifecycle: string | null;
  }>(`/governance/actions/${encodeURIComponent(actionId)}/resolve`, {
    resolution_status: resolutionStatus,
    note: note ?? ""
  });
  if (result) notifyGovernanceUpdated();
  return result;
}
