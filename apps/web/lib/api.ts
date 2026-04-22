const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:8000";
const API_PREFIX = "/api/v1";

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${API_PREFIX}${path}`, {
    next: { revalidate: 0 }
  });
  if (!res.ok) {
    throw new Error(`API request failed for ${path}: ${res.status}`);
  }
  return res.json();
}

export async function getSystems() {
  return apiGet<{ items: any[] }>("/systems");
}

export async function getSystemDetail(id: string) {
  return apiGet<{ item: any }>(`/systems/${id}`);
}

export async function getTelemetryEvents(query = "") {
  return apiGet<{ items: any[] }>(`/telemetry/events${query}`);
}

export async function getIncidents() {
  return apiGet<{ items: any[] }>("/incidents");
}

export async function getIncidentDetail(id: string) {
  return apiGet<{
    incident: any;
    telemetry_context: any;
    audit_entries: any[];
  }>(`/incidents/${id}`);
}

export async function getRules() {
  return apiGet<{ items: any[] }>("/rules");
}

export async function getAuditLogs() {
  return apiGet<{ items: any[] }>("/audit-logs");
}

import type { BobInvestigation, BobRecommendation } from "./bob-types";

export async function getBobInvestigations(params?: {
  status?: string;
  target_type?: string;
  target_id?: string;
}) {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.target_type) search.set("target_type", params.target_type);
  if (params?.target_id) search.set("target_id", params.target_id);
  const qs = search.toString();
  return apiGet<{ items: BobInvestigation[] }>(
    `/bob/investigations${qs ? `?${qs}` : ""}`
  );
}

export async function getBobInvestigation(id: string) {
  return apiGet<{ item: BobInvestigation }>(`/bob/investigations/${id}`);
}

export async function getBobInvestigationForTarget(
  targetType: string,
  targetId: string
) {
  return apiGet<{ item: BobInvestigation | null }>(
    `/bob/investigations/for/${targetType}/${targetId}`
  );
}

export async function getBobRecommendations(params?: {
  status?: string;
  target_type?: string;
  target_id?: string;
}) {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.target_type) search.set("target_type", params.target_type);
  if (params?.target_id) search.set("target_id", params.target_id);
  const qs = search.toString();
  return apiGet<{ items: BobRecommendation[] }>(
    `/bob/recommendations${qs ? `?${qs}` : ""}`
  );
}

import type { Action, AccessPolicy } from "./action-types";

export async function getActions(params?: {
  execution_status?: string;
  approval_status?: string;
  risk_level?: string;
  source_type?: string;
  source_id?: string;
  target_system_id?: string;
  related_incident_id?: string;
  related_control_id?: string;
  bob_investigation_id?: string;
}) {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v) search.set(k, v);
  }
  const qs = search.toString();
  return apiGet<{ items: Action[] }>(`/actions${qs ? `?${qs}` : ""}`);
}

export async function getAction(id: string) {
  return apiGet<{ item: Action }>(`/actions/${id}`);
}

export async function getAccessPolicy(systemId: string) {
  return apiGet<{ item: AccessPolicy }>(`/access-policies/${systemId}`);
}

import type {
  BobImpactSummary,
  Change,
  ConnectorStatus,
  EnvironmentConfig,
  ExecutionConsoleEntry,
  Integration,
  OperationsPolicy,
  SystemOperations
} from "./operations-types";

export async function getIntegrations() {
  return apiGet<{ items: Integration[] }>("/integrations");
}

export async function getEnvironments() {
  return apiGet<{ items: EnvironmentConfig[] }>("/environments");
}

export async function getOperationsPolicies() {
  return apiGet<{ items: OperationsPolicy[] }>("/operations-policies");
}

export async function getConnectorStatus() {
  return apiGet<{ items: ConnectorStatus[] }>("/connector-status");
}

export async function getExecutionConsole(params?: {
  target_system_id?: string;
  action_id?: string;
  investigation_id?: string;
  integration_id?: string;
  limit?: number;
}) {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== null) search.set(k, String(v));
  }
  const qs = search.toString();
  return apiGet<{ items: ExecutionConsoleEntry[] }>(
    `/execution-console${qs ? `?${qs}` : ""}`
  );
}

export async function getSystemOperations(systemId: string) {
  return apiGet<{ item: SystemOperations }>(`/system-operations/${systemId}`);
}

export async function getChanges(params?: {
  target_system_id?: string;
  source_action_id?: string;
  source_investigation_id?: string;
  source_incident_id?: string;
  impact_status?: string;
  limit?: number;
}) {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== null) search.set(k, String(v));
  }
  const qs = search.toString();
  return apiGet<{ items: Change[] }>(`/changes${qs ? `?${qs}` : ""}`);
}

export async function getChangeForAction(actionId: string) {
  return apiGet<{ item: Change }>(`/changes/by-action/${actionId}`);
}

export async function getChange(id: string) {
  return apiGet<{ item: Change }>(`/changes/${id}`);
}

export async function getBobImpactSummary() {
  return apiGet<{ item: BobImpactSummary }>("/bob-impact-summary");
}
