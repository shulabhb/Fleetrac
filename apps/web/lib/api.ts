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
