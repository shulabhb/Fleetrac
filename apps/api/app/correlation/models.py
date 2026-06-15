"""Correlation domain types (in-memory)."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class CorrelationCandidate:
    candidate_id: str
    tenant_id: str
    environment: str
    system_id: str
    trace_id: str | None
    span_id: str | None
    event_id: str
    signal_type: str
    risk_category: str
    timestamp: datetime
    severity_hint: str | None = None
    confidence_hint: float | None = None
    source_span_name: str | None = None
    control_ids: list[str] = field(default_factory=list)
    relevant_attributes: dict[str, Any] = field(default_factory=dict)
    business_outcome: str | None = None
    evidence_role: str = "supporting"  # primary | supporting | mitigating
    rule_id: str | None = None
    metric_value: float | None = None


@dataclass
class RiskAssessmentResult:
    assessment_id: str
    cluster_id: str
    incident_id: str | None
    diagnosis_family: str
    diagnosis_label: str
    risk_category: str
    severity: str
    confidence: float
    confidence_label: str
    score: int
    contributing_factors: list[str]
    mitigating_factors: list[str]
    reasons: list[str]
    why_not_higher: list[str]
    recommended_action: str
    assessed_at: datetime
    policy_version: str
    primary_evidence: list[str] = field(default_factory=list)
    supporting_evidence: list[str] = field(default_factory=list)
    mitigating_evidence: list[str] = field(default_factory=list)
