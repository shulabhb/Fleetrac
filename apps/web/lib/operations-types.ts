export type OperationsState =
  | "active"
  | "paused"
  | "maintenance"
  | "degraded"
  | "rollback_ready"
  | "canary"
  | "disabled"
  | "internal_testing";

export type ReleaseChannel =
  | "production"
  | "canary"
  | "fallback"
  | "staging"
  | "internal";

export type MaintenanceWindow = {
  active: boolean;
  reason?: string | null;
  started_at?: string | null;
  ends_at?: string | null;
  suppress_incident_noise: boolean;
  bob_allowed_during_maintenance: boolean;
};

export type SystemOperations = {
  system_id: string;
  operations_state: OperationsState;
  operations_state_reason?: string | null;

  current_version: string;
  previous_version?: string | null;
  candidate_version?: string | null;
  release_channel: ReleaseChannel;
  deployed_at: string;
  last_changed_by: string;

  rollback_available: boolean;
  rollback_target?: string | null;
  rollback_requires_approval: boolean;
  rollback_recommended: boolean;
  rollback_blocked_reason?: string | null;

  maintenance: MaintenanceWindow;

  canary_active: boolean;
  canary_traffic_pct?: number | null;
  fallback_available: boolean;

  last_config_change_summary?: string | null;
  last_config_change_at?: string | null;

  updated_at: string;
};

export type IntegrationKind =
  | "cloud"
  | "data_platform"
  | "model_provider"
  | "observability"
  | "ticketing"
  | "workflow"
  | "model_registry"
  | "internal_model_api";

export type IntegrationConnectionStatus =
  | "connected"
  | "degraded"
  | "disconnected"
  | "needs_auth";

export type IntegrationAuthStatus =
  | "ok"
  | "token_expiring"
  | "expired"
  | "unauthorized"
  | "not_configured";

export type IntegrationSyncStatus =
  | "healthy"
  | "delayed"
  | "failing"
  | "idle"
  | "paused";

export type ConnectorType = "api" | "sidecar" | "log_stream" | "proxy" | "manual";

export type TelemetryAvailability = "full" | "partial" | "metadata_only" | "none";

export type ConfigAccessLevel = "read_only" | "read_write" | "none";

export type IntegrationActionScope =
  | "none"
  | "read_only"
  | "prepare_only"
  | "approval_gated"
  | "limited_execution";

export type Integration = {
  id: string;
  provider: string;
  kind: IntegrationKind;
  connection_status: IntegrationConnectionStatus;
  auth_status: IntegrationAuthStatus;
  sync_status: IntegrationSyncStatus;
  connector_type: ConnectorType;
  environments: string[];
  telemetry_availability: TelemetryAvailability;
  config_access: ConfigAccessLevel;
  action_scope: IntegrationActionScope;
  last_sync?: string | null;
  note?: string | null;
  capabilities: string[];
};

export type EnvironmentKind =
  | "production"
  | "staging"
  | "sandbox"
  | "internal_only";

export type EnvironmentConfig = {
  id: string;
  label: string;
  kind: EnvironmentKind;
  description: string;
  default_bob_mode:
    | "observe_only"
    | "recommend_only"
    | "prepare_actions"
    | "approval_gated_execution"
    | "limited_auto_execution";
  approval_policy_label: string;
  auto_execute_low_risk: boolean;
  maintenance_suppresses_alerts: boolean;
  bob_allowed_during_maintenance: boolean;
  rollback_requires_dual_approval: boolean;
  threshold_tuning_pre_approved: boolean;
  ticket_creation_always_allowed: boolean;
  system_count: number;
};

export type OperationsPolicyCategory =
  | "bob_defaults"
  | "approvals"
  | "execution"
  | "maintenance"
  | "rollback"
  | "audit";

export type OperationsPolicy = {
  id: string;
  label: string;
  description: string;
  category: OperationsPolicyCategory;
  current_value: string;
  allowed_values: string[];
  scope: string;
  last_changed_by: string;
  last_changed_at: string;
};

export type ServiceHealth = "healthy" | "degraded" | "down" | "unknown";

export type ConnectorArea =
  | "telemetry_ingest"
  | "cloud_logs"
  | "config_metadata"
  | "action_runner"
  | "ticketing"
  | "workflow_runner"
  | "bob_investigation"
  | "version_sync"
  | "model_registry";

export type ConnectorStatus = {
  id: string;
  name: string;
  area: ConnectorArea;
  health: ServiceHealth;
  last_check_at: string;
  latency_ms?: number | null;
  note?: string | null;
  integration_id?: string | null;
};

export type ExecutionConsoleSeverity = "info" | "notice" | "warn" | "error";

export type ExecutionConsoleOutcome =
  | "prepared"
  | "staged"
  | "executed"
  | "handed_off"
  | "blocked"
  | "acknowledged";

export type ExecutionConsoleEntry = {
  id: string;
  timestamp: string;
  actor: string;
  action_code: string;
  action_label: string;
  severity: ExecutionConsoleSeverity;
  target_system_id?: string | null;
  target_system_name?: string | null;
  action_id?: string | null;
  investigation_id?: string | null;
  integration_id?: string | null;
  integration_label?: string | null;
  outcome: ExecutionConsoleOutcome;
  details: string;
};

export type ChangeLifecycleState =
  | "proposed"
  | "approved"
  | "executed"
  | "monitoring"
  | "improvement_observed"
  | "no_material_change"
  | "regression_detected"
  | "rollback_candidate"
  | "follow_up_required"
  | "closed";

export type ChangedBy = "bob" | "human" | "bob_with_approval" | "external_team";

export type MetricDelta = {
  metric: string;
  label: string;
  before?: number | null;
  after?: number | null;
  unit?: string | null;
  direction: "lower_is_better" | "higher_is_better";
  baseline_window: string;
  monitoring_window: string;
};

export type Change = {
  id: string;
  change_type: string;
  change_summary: string;

  source_action_id?: string | null;
  source_investigation_id?: string | null;
  source_incident_id?: string | null;

  target_system_id: string;
  target_system_name: string;
  environment: EnvironmentKind;

  changed_by: ChangedBy;
  changed_by_label: string;

  version_before?: string | null;
  version_after?: string | null;
  config_before?: string | null;
  config_after?: string | null;
  maintenance_state_before?: string | null;
  maintenance_state_after?: string | null;

  expected_impact_summary: string;
  watched_metrics: string[];
  baseline_window: string;
  monitoring_window: string;

  actual_outcome_summary: string;
  metric_deltas: MetricDelta[];

  recurrence_before?: number | null;
  recurrence_after?: number | null;
  reviewer_burden_before?: number | null;
  reviewer_burden_after?: number | null;

  impact_status: ChangeLifecycleState;
  rollback_recommended: boolean;
  rollback_available: boolean;
  follow_up_required: boolean;

  executed_at: string;
  evaluated_at?: string | null;
};

export type BobImpactSummary = {
  window_label: string;
  actions_executed: number;
  improvements_observed: number;
  no_material_change: number;
  regressions_detected: number;
  rollback_candidates: number;
  recurrence_reduced: number;
  reviewer_burden_reduced: number;
  control_fires_reduced: number;
};
