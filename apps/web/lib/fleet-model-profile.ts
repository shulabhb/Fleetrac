/**
 * Demo-fleet model facts used by Agent Fleet and Settings.
 * Telemetry channels match the fleet registry source types.
 * A repository name saved here stays in the browser and does not connect source control.
 */

export type TelemetryChannel = {
  id: string;
  label: string;
};

export type TrackControl = {
  id: string;
  label: string;
};

export type ModelProfile = {
  systemId: string;
  integrationId: string;
  providerKey: string;
  provider: string;
  channels: TelemetryChannel[];
  controls: TrackControl[];
};

export const MODEL_PROFILES: ModelProfile[] = [
  {
    systemId: "sys-agt-treasury-001",
    integrationId: "int_vertex",
    providerKey: "vertex",
    provider: "Vertex AI",
    channels: [
      { id: "vertex_ai_invocation", label: "Vertex AI invocations" },
      { id: "langgraph_trace", label: "LangGraph trace" },
      { id: "otel_agent_trace", label: "OpenTelemetry agent trace" }
    ],
    controls: [{ id: "unsupported_claim_rate", label: "Unsupported claim rate" }]
  },
  {
    systemId: "sys-agt-phish-008",
    integrationId: "int_azure_openai",
    providerKey: "azure",
    provider: "Azure OpenAI",
    channels: [
      { id: "azure_openai_invocation", label: "Azure OpenAI invocations" },
      { id: "policy_engine_event", label: "Policy engine events" }
    ],
    controls: [{ id: "tool_scope", label: "Tool-scope anomaly" }]
  },
  {
    systemId: "sys-agt-cs-002",
    integrationId: "int_azure_openai",
    providerKey: "azure",
    provider: "Azure OpenAI",
    channels: [
      { id: "azure_openai_invocation", label: "Azure OpenAI invocations" },
      { id: "langgraph_trace", label: "LangGraph trace" }
    ],
    controls: [{ id: "latency_ms", label: "Latency" }]
  },
  {
    systemId: "sys-agt-rag-007",
    integrationId: "int_bedrock",
    providerKey: "bedrock",
    provider: "AWS Bedrock",
    channels: [
      { id: "aws_bedrock_invocation", label: "AWS Bedrock invocations" },
      { id: "otel_agent_trace", label: "OpenTelemetry agent trace" }
    ],
    controls: [{ id: "retrieval_failure_rate", label: "Retrieval failure" }]
  },
  {
    systemId: "sys-agt-access-009",
    integrationId: "int_bedrock",
    providerKey: "bedrock",
    provider: "AWS Bedrock",
    channels: [
      { id: "aws_bedrock_invocation", label: "AWS Bedrock invocations" },
      { id: "policy_engine_event", label: "Policy engine events" }
    ],
    controls: [{ id: "unapproved_region", label: "Unapproved region" }]
  }
];

const BY_SYSTEM = new Map(MODEL_PROFILES.map((profile) => [profile.systemId, profile]));

export function modelProfileFor(systemId: string | null | undefined): ModelProfile | null {
  if (!systemId) return null;
  return BY_SYSTEM.get(systemId) ?? null;
}

export type ModelPreference = {
  trackedControls: string[];
  enabledChannels: string[];
  repository: string;
};

const STORAGE_KEY = "fleetrac-model-preferences";
export const MODEL_PREFS_EVENT = "fleetrac-model-preferences";

export function defaultPreference(profile: ModelProfile): ModelPreference {
  return {
    trackedControls: profile.controls.map((control) => control.id),
    enabledChannels: profile.channels.map((channel) => channel.id),
    repository: ""
  };
}

export function loadPreferences(): Record<string, ModelPreference> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ModelPreference>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function preferenceFor(
  systemId: string,
  stored?: Record<string, ModelPreference> | null
): ModelPreference | null {
  const profile = modelProfileFor(systemId);
  if (!profile) return null;
  const saved = stored?.[systemId];
  if (!saved) return defaultPreference(profile);
  return {
    trackedControls: Array.isArray(saved.trackedControls)
      ? saved.trackedControls
      : defaultPreference(profile).trackedControls,
    enabledChannels: Array.isArray(saved.enabledChannels)
      ? saved.enabledChannels
      : defaultPreference(profile).enabledChannels,
    repository: typeof saved.repository === "string" ? saved.repository : ""
  };
}

export function savePreference(systemId: string, preference: ModelPreference): void {
  if (typeof window === "undefined") return;
  const next = { ...loadPreferences(), [systemId]: preference };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(MODEL_PREFS_EVENT));
}

export function telemetrySummary(profile: ModelProfile, preference: ModelPreference): string {
  const labels = profile.channels
    .filter((channel) => preference.enabledChannels.includes(channel.id))
    .map((channel) => channel.label);
  if (!labels.length) return "No telemetry selected";
  return labels.join(" · ");
}

export function repositorySummary(preference: ModelPreference | null): string {
  const name = preference?.repository.trim() ?? "";
  if (!name) return "Not connected";
  return `${name} · recorded locally, source control is not connected`;
}
