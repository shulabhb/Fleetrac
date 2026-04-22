from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


InvestigationStatus = Literal[
    "draft",
    "ready_for_review",
    "awaiting_approval",
    "approved",
    "rejected",
    "executed",
    "monitoring_outcome",
]

ConfidenceTier = Literal["low", "medium", "high"]

ApprovalStatus = Literal["not_required", "pending", "approved", "rejected"]

RecommendationType = Literal[
    "retrain_candidate",
    "tighten_review_gate",
    "retrieval_freshness_review",
    "tune_threshold",
    "route_to_owner",
    "upstream_data_investigation",
    "escalate",
    "rollback_candidate",
    "increase_audit_sampling",
    "observe_next_window",
    "control_tuning",
    "cluster_escalation",
]

TargetType = Literal["incident", "system", "control"]

EvidenceType = Literal[
    "telemetry_snapshot",
    "similar_incidents",
    "active_controls",
    "audit_coverage",
    "threshold_history",
    "governance_activity",
    "recurrence_pattern",
    "drift_trend",
    "control_fire_rate",
]


class BobEvidence(BaseModel):
    id: str
    type: EvidenceType
    label: str
    detail: str
    reference_id: str | None = None
    value: str | None = None


class BobActivityEvent(BaseModel):
    id: str
    timestamp: datetime
    action: str
    detail: str


class BobRecommendation(BaseModel):
    id: str
    investigation_id: str
    type: RecommendationType
    title: str
    rationale_summary: str
    target_type: TargetType
    target_id: str
    target_label: str | None = None
    confidence: ConfidenceTier
    confidence_score: float = Field(ge=0, le=1)
    owner_team: str
    approval_required: bool = True
    approval_status: ApprovalStatus = "pending"
    remediation_type: str


class BobInvestigation(BaseModel):
    id: str
    title: str
    target_type: TargetType
    target_id: str
    target_label: str
    status: InvestigationStatus
    confidence: ConfidenceTier
    confidence_score: float = Field(ge=0, le=1)
    summary: str
    likely_root_cause: str
    alternative_hypothesis: str | None = None
    why_it_matters: str
    suggested_owner: str
    top_recommendation_id: str | None = None
    recurring_issue_flag: bool = False
    evidence: list[BobEvidence] = Field(default_factory=list)
    activity: list[BobActivityEvent] = Field(default_factory=list)
    recommendations: list[BobRecommendation] = Field(default_factory=list)
    signal_type: str | None = None
    risk_domain: str | None = None
    created_at: datetime
    updated_at: datetime
    last_bob_run_at: datetime
