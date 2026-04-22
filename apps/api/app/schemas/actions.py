"""Schemas for Fleetrac's Access, Approval and Action framework.

These models power the Action Center — a first-class governed-action surface
that sits between Bob's recommendations, human approval, and downstream
execution. The model is deliberately rich so the UI can demonstrate realistic
enterprise governance (blast radius, approval routing, monitoring outcomes)
without requiring a real execution backend.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


ActionSourceType = Literal[
    "incident",
    "system",
    "control",
    "bob_investigation",
]


# -- Taxonomy ---------------------------------------------------------------
#
# Action types span the full low-/medium-/high-risk surface described in the
# governance product spec. The taxonomy is intentionally broader than today's
# recommendation types so the Action Center can show real variety.

ActionType = Literal[
    # Low-risk / administrative
    "open_ticket",
    "create_followup_review",
    "assign_owner",
    "draft_runbook",
    "request_review",
    "schedule_monitoring_window",
    # Medium-risk / bounded technical
    "prepare_threshold_change",
    "prepare_control_split",
    "prepare_config_suggestion",
    "prepare_routing_change",
    "prepare_review_gate_tightening",
    "prepare_fallback_activation",
    # Higher-risk / stricter control
    "request_rollback",
    "request_workflow_pause",
    "request_traffic_reroute",
    "request_model_disablement",
    "request_emergency_review_path",
    "prepare_auto_remediation_candidate",
]


ApprovalState = Literal[
    "not_required",
    "pending",
    "approved",
    "rejected",
    "escalated",
]


ExecutionState = Literal[
    "drafted",
    "awaiting_approval",
    "approved",
    "rejected",
    "prepared",
    "ready_to_execute",
    "executed",
    "monitoring_outcome",
    "closed",
    "reverted",
    "follow_up_required",
]


MonitoringStatus = Literal[
    "not_applicable",
    "monitoring_next_window",
    "awaiting_telemetry",
    "no_meaningful_change",
    "improvement_observed",
    "regression_detected",
    "rollback_recommended",
    "reviewer_signoff_pending",
]


RiskLevel = Literal["low", "medium", "high"]


ExecutionMode = Literal[
    "manual_handoff",
    "bob_prepares",
    "approval_gated",
    "auto_within_bounds",
]


BlastRadius = Literal[
    "single_system",
    "workflow_slice",
    "system_fleet",
    "non_customer_facing",
    "staging_only",
    "reversible_only",
]


SuggestedBy = Literal["bob", "human", "mixed"]

ConfidenceTier = Literal["low", "medium", "high"]


class Action(BaseModel):
    """Governed action prepared for or executed on a target system.

    An action is always backed by a source object (incident / system / control
    / Bob investigation) and carries explicit approval, execution and
    monitoring state so the Action Center can render the full lifecycle.
    """

    id: str
    title: str
    action_type: ActionType
    source_type: ActionSourceType
    source_id: str
    bob_investigation_id: str | None = None
    recommendation_id: str | None = None

    target_system_id: str | None = None
    target_system_name: str | None = None
    related_incident_id: str | None = None
    related_control_id: str | None = None

    suggested_by: SuggestedBy
    action_scope: str
    recommended_owner: str
    required_approver: str
    approval_policy: str
    approval_status: ApprovalState
    execution_status: ExecutionState
    execution_mode: ExecutionMode
    reversible: bool
    blast_radius: BlastRadius
    risk_level: RiskLevel
    confidence: ConfidenceTier
    confidence_score: float = Field(ge=0, le=1)

    allowed_by_policy: bool = True
    blocked_reason: str | None = None

    prepared_change_summary: str
    execution_notes: str | None = None
    monitoring_status: MonitoringStatus = "not_applicable"
    monitoring_note: str | None = None

    rejection_reason: str | None = None
    alternative_suggestion: str | None = None

    created_at: datetime
    updated_at: datetime
    executed_at: datetime | None = None
    monitored_until: datetime | None = None


# -- Access & Action Policy -------------------------------------------------


BobOperatingMode = Literal[
    "observe_only",
    "recommend_only",
    "prepare_actions",
    "approval_gated_execution",
    "limited_auto_execution",
]

TelemetryLevel = Literal["full", "partial", "metrics_only", "logs_only"]
ConfigAccess = Literal["read_only", "read_write", "none"]
LogsAccess = Literal["connected", "partial", "unavailable"]
ActionLevel = Literal[
    "none",
    "prepare_only",
    "approval_gated",
    "limited_execution",
]


class AccessPolicy(BaseModel):
    """Per-system Access & Action Policy.

    This is the enterprise contract that governs what Fleetrac/Bob can see,
    prepare, and execute on a given system. It is intentionally descriptive so
    it reads like a real customer policy, not a feature flag file.
    """

    system_id: str
    bob_operating_mode: BobOperatingMode

    # Coarse access levels — drive the enterprise credibility strip.
    telemetry_level: TelemetryLevel
    config_access: ConfigAccess
    logs_access: LogsAccess
    action_level: ActionLevel
    integration_mode: str
    environment: Literal["production", "staging", "internal_only", "sandbox"]

    # Detailed policy categories shown in the Access & Action Policy panel.
    observability_access: list[str]
    integration_access: list[str]
    approval_policy: list[str]
    allowed_actions: list[ActionType]
    restricted_actions: list[str]
    execution_boundary: list[str]

    primary_approver: str
    secondary_approver: str | None = None

    updated_at: datetime
