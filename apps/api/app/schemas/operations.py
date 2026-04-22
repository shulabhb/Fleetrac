"""Schemas for Fleetrac's Operations & Impact layer.

These models power the Settings control plane (integrations, environments,
operations policies, connector status, execution console) and the
Changes & Impact concept that closes the loop from Bob recommendation ->
approved action -> measured outcome.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Per-system operations metadata
# ---------------------------------------------------------------------------


OperationsState = Literal[
    "active",
    "paused",
    "maintenance",
    "degraded",
    "rollback_ready",
    "canary",
    "disabled",
    "internal_testing",
]


ReleaseChannel = Literal["production", "canary", "fallback", "staging", "internal"]


class MaintenanceWindow(BaseModel):
    active: bool = False
    reason: str | None = None
    started_at: datetime | None = None
    ends_at: datetime | None = None
    suppress_incident_noise: bool = True
    bob_allowed_during_maintenance: bool = False


class SystemOperations(BaseModel):
    """Governed operational state of a single system.

    This is the production-asset view: what version is live, what can be
    rolled back, whether maintenance is in effect, and what Bob can do right
    now. All fields are mock but shaped to feel like a real control plane.
    """

    system_id: str
    operations_state: OperationsState
    operations_state_reason: str | None = None

    # Versioning
    current_version: str
    previous_version: str | None = None
    candidate_version: str | None = None
    release_channel: ReleaseChannel = "production"
    deployed_at: datetime
    last_changed_by: str

    # Rollback
    rollback_available: bool = True
    rollback_target: str | None = None
    rollback_requires_approval: bool = True
    rollback_recommended: bool = False
    rollback_blocked_reason: str | None = None

    # Maintenance
    maintenance: MaintenanceWindow = Field(default_factory=MaintenanceWindow)

    # Canary / fallback
    canary_active: bool = False
    canary_traffic_pct: float | None = None
    fallback_available: bool = True

    # Last configuration change summary
    last_config_change_summary: str | None = None
    last_config_change_at: datetime | None = None

    updated_at: datetime


# ---------------------------------------------------------------------------
# Integrations (Settings > Integrations)
# ---------------------------------------------------------------------------


IntegrationKind = Literal[
    "cloud",
    "data_platform",
    "model_provider",
    "observability",
    "ticketing",
    "workflow",
    "model_registry",
    "internal_model_api",
]


IntegrationConnectionStatus = Literal[
    "connected",
    "degraded",
    "disconnected",
    "needs_auth",
]


IntegrationAuthStatus = Literal[
    "ok",
    "token_expiring",
    "expired",
    "unauthorized",
    "not_configured",
]


IntegrationSyncStatus = Literal[
    "healthy",
    "delayed",
    "failing",
    "idle",
    "paused",
]


ConnectorType = Literal["api", "sidecar", "log_stream", "proxy", "manual"]

TelemetryAvailability = Literal["full", "partial", "metadata_only", "none"]

ConfigAccessLevel = Literal["read_only", "read_write", "none"]

IntegrationActionScope = Literal[
    "none",
    "read_only",
    "prepare_only",
    "approval_gated",
    "limited_execution",
]


class Integration(BaseModel):
    id: str
    provider: str
    kind: IntegrationKind
    connection_status: IntegrationConnectionStatus
    auth_status: IntegrationAuthStatus
    sync_status: IntegrationSyncStatus
    connector_type: ConnectorType
    environments: list[str]
    telemetry_availability: TelemetryAvailability
    config_access: ConfigAccessLevel
    action_scope: IntegrationActionScope
    last_sync: datetime | None = None
    note: str | None = None
    capabilities: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Environments (Settings > Environments)
# ---------------------------------------------------------------------------


EnvironmentKind = Literal["production", "staging", "sandbox", "internal_only"]


class EnvironmentConfig(BaseModel):
    id: str
    label: str
    kind: EnvironmentKind
    description: str
    default_bob_mode: Literal[
        "observe_only",
        "recommend_only",
        "prepare_actions",
        "approval_gated_execution",
        "limited_auto_execution",
    ]
    approval_policy_label: str
    auto_execute_low_risk: bool
    maintenance_suppresses_alerts: bool
    bob_allowed_during_maintenance: bool
    rollback_requires_dual_approval: bool
    threshold_tuning_pre_approved: bool
    ticket_creation_always_allowed: bool
    system_count: int


# ---------------------------------------------------------------------------
# Operations policies (Settings > System Operations Policies)
# ---------------------------------------------------------------------------


class OperationsPolicy(BaseModel):
    """Fleet-wide default governance / action policies (mock)."""

    id: str
    label: str
    description: str
    category: Literal[
        "bob_defaults",
        "approvals",
        "execution",
        "maintenance",
        "rollback",
        "audit",
    ]
    current_value: str
    allowed_values: list[str]
    scope: str
    last_changed_by: str
    last_changed_at: datetime


# ---------------------------------------------------------------------------
# Connector / service status (Settings > Service / Connector Status)
# ---------------------------------------------------------------------------


ServiceHealth = Literal["healthy", "degraded", "down", "unknown"]


class ConnectorStatus(BaseModel):
    id: str
    name: str
    area: Literal[
        "telemetry_ingest",
        "cloud_logs",
        "config_metadata",
        "action_runner",
        "ticketing",
        "workflow_runner",
        "bob_investigation",
        "version_sync",
        "model_registry",
    ]
    health: ServiceHealth
    last_check_at: datetime
    latency_ms: int | None = None
    note: str | None = None
    integration_id: str | None = None


# ---------------------------------------------------------------------------
# Execution Console
# ---------------------------------------------------------------------------


ExecutionConsoleSeverity = Literal["info", "notice", "warn", "error"]


class ExecutionConsoleEntry(BaseModel):
    """Single row in the Execution Console / Connector Action Log.

    These are the visible operational acts Fleetrac / Bob have performed or
    prepared — ticket opens, staged threshold changes, routing handoffs,
    maintenance toggles, workflow diagnostic runs. Intentionally not a shell
    log: this is governance-visible doing.
    """

    id: str
    timestamp: datetime
    actor: str
    action_code: str
    action_label: str
    severity: ExecutionConsoleSeverity
    target_system_id: str | None = None
    target_system_name: str | None = None
    action_id: str | None = None
    investigation_id: str | None = None
    integration_id: str | None = None
    integration_label: str | None = None
    outcome: Literal[
        "prepared",
        "staged",
        "executed",
        "handed_off",
        "blocked",
        "acknowledged",
    ]
    details: str


# ---------------------------------------------------------------------------
# Changes & Impact
# ---------------------------------------------------------------------------


ChangeLifecycleState = Literal[
    "proposed",
    "approved",
    "executed",
    "monitoring",
    "improvement_observed",
    "no_material_change",
    "regression_detected",
    "rollback_candidate",
    "follow_up_required",
    "closed",
]


ChangedBy = Literal["bob", "human", "bob_with_approval", "external_team"]


class MetricDelta(BaseModel):
    """Before/after comparison for a single metric."""

    metric: str
    label: str
    before: float | None = None
    after: float | None = None
    unit: str | None = None
    direction: Literal["lower_is_better", "higher_is_better"]
    baseline_window: str
    monitoring_window: str


class Change(BaseModel):
    """A first-class governed change with expected and actual impact."""

    id: str
    change_type: str
    change_summary: str

    source_action_id: str | None = None
    source_investigation_id: str | None = None
    source_incident_id: str | None = None

    target_system_id: str
    target_system_name: str
    environment: EnvironmentKind

    changed_by: ChangedBy
    changed_by_label: str

    version_before: str | None = None
    version_after: str | None = None
    config_before: str | None = None
    config_after: str | None = None
    maintenance_state_before: str | None = None
    maintenance_state_after: str | None = None

    expected_impact_summary: str
    watched_metrics: list[str]
    baseline_window: str
    monitoring_window: str

    actual_outcome_summary: str
    metric_deltas: list[MetricDelta] = Field(default_factory=list)

    recurrence_before: int | None = None
    recurrence_after: int | None = None
    reviewer_burden_before: int | None = None
    reviewer_burden_after: int | None = None

    impact_status: ChangeLifecycleState
    rollback_recommended: bool = False
    rollback_available: bool = True
    follow_up_required: bool = False

    executed_at: datetime
    evaluated_at: datetime | None = None


# ---------------------------------------------------------------------------
# Aggregate analytics
# ---------------------------------------------------------------------------


class BobImpactSummary(BaseModel):
    window_label: str
    actions_executed: int
    improvements_observed: int
    no_material_change: int
    regressions_detected: int
    rollback_candidates: int
    recurrence_reduced: int
    reviewer_burden_reduced: int
    control_fires_reduced: int
