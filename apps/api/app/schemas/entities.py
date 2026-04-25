from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class TelemetryEvent(BaseModel):
    id: str
    system_id: str
    model_name: str
    timestamp: datetime
    accuracy_pct: float | None = None
    error_pct: float | None = None
    latency_p95_ms: float | None = None
    drift_index: float | None = None
    grounding_score: float | None = None
    unsupported_claim_rate: float | None = None
    retrieval_failure_rate: float | None = None
    audit_coverage_pct: float | None = None
    policy_violation_rate: float | None = None
    security_anomaly_count: int | None = None
    cost_per_1k_requests: float | None = None
    risk_signals: list[str] = Field(default_factory=list)


class Incident(BaseModel):
    id: str
    title: str
    category: str
    risk_category: Literal[
        "technology risk",
        "cyber risk",
        "governance / compliance risk",
        "output reliability risk",
    ]
    incident_status: Literal["open", "pending", "closed"] = "open"
    escalation_status: Literal["not_escalated", "pending", "escalated"] = "not_escalated"
    review_required: bool = True
    severity: Literal["low", "medium", "high"]
    system_id: str
    system_name: str
    rule_id: str
    trigger_metric: str
    trigger_reason: str
    threshold: str
    observed_value: float | int
    expected_value: float | int | None = None
    summary: str
    recommended_action: str
    owner_team: str
    created_at: datetime


class Rule(BaseModel):
    id: str
    name: str
    description: str
    category: str
    comparator: Literal[">", "<", ">=", "<="]
    threshold_field: str
    observed_field: str
    severity: Literal["low", "medium", "high"]
    enabled: bool = True


class System(BaseModel):
    id: str
    name: str
    owner: str
    environment: Literal["staging", "production"]
    model: str
    model_type: str
    use_case: str
    telemetry_archetype: str
    business_function: str
    deployment_scope: str
    regulatory_sensitivity: str
    control_owner: str
    risk_posture: Literal["healthy", "watch", "at_risk", "critical"]
    hosting_environment: str | None = None
    integration_mode: str | None = None
    telemetry_coverage: float | None = None
    connection_status: Literal["connected", "degraded", "stale"] | None = None


class AuditLogEntry(BaseModel):
    id: str
    actor: str
    action: str
    target_type: str
    target_id: str
    details: str
    timestamp: datetime
