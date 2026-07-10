from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.analysis import FleetracAnalysis


class GovernanceIdentityMixin(BaseModel):
    id: str
    alias_id: str | None = None
    system_id: str
    display_system_id: str
    system_name: str
    system_name_alias: str | None = None


class LiveSignalRow(GovernanceIdentityMixin):
    event_id: str
    timestamp: datetime
    operation_type: str
    signal_state: str = "healthy"
    normalized_signal_type: str | None = None
    severity: str | None = None
    confidence: float | None = None
    incident_id: str | None = None
    trace_id: str | None = None
    span_id: str | None = None
    parent_span_id: str | None = None
    latency_ms: float | None = None
    evaluation_signals: dict[str, Any] = Field(default_factory=dict)
    accountable_owner_team: str | None = None
    owner_team: str | None = None
    source_type: str | None = None
    source_provider: str | None = None
    model: str | None = None


class LiveSignalsResponse(BaseModel):
    items: list[LiveSignalRow]
    total: int


class IngestLogNormalizedDTO(BaseModel):
    event_id: str
    timestamp: datetime
    source_provider: str
    source_type: str
    operation_type: str
    model: str | None = None
    severity: str | None = None
    normalized_signal_type: str | None = None
    incident_id: str | None = None
    trace_id: str | None = None
    span_id: str | None = None
    latency_ms: float | None = None
    evaluation_signals: dict[str, Any] = Field(default_factory=dict)


class IngestLogRow(BaseModel):
    raw_event_id: str
    ingested_at: datetime
    system_id: str
    display_system_id: str
    system_name: str
    idempotency_key: str
    payload_hash: str
    source_type: str
    raw_payload: dict[str, Any]
    normalized: IngestLogNormalizedDTO | None = None
    normalized_spans: list[IngestLogNormalizedDTO] = Field(default_factory=list)


class IngestLogResponse(BaseModel):
    items: list[IngestLogRow]
    total: int


class OwnerQueueRow(GovernanceIdentityMixin):
    lifecycle: str
    classification_category: str
    severity: str
    priority: str
    accountable_owner_team: str
    responder_team: str
    owner_team: str
    title: str
    summary: str
    reviewer: str | None = None
    opened_at: datetime
    updated_at: datetime
    diagnosis_family: str | None = None
    severity_reason: str | None = None
    assessment_confidence: float | None = None
    occurrence_count: int | None = None
    trace_count: int | None = None
    highest_severity: str | None = None


class OwnerQueueResponse(BaseModel):
    items: list[OwnerQueueRow]
    total: int


class EvidenceItemDTO(BaseModel):
    id: str
    kind: str
    reference_id: str
    summary: str
    created_at: datetime
    trace_id: str | None = None
    span_id: str | None = None
    operation_type: str | None = None
    evaluation_signals: dict[str, Any] = Field(default_factory=dict)


class EvidenceRecordDTO(GovernanceIdentityMixin):
    incident_id: str
    status: str
    packaged_at: datetime
    owner_team: str | None = None
    title: str | None = None
    severity: str | None = None
    lifecycle: str | None = None
    classification_category: str | None = None
    reviewer: str | None = None
    items: list[EvidenceItemDTO]
    fleetrac_analysis: FleetracAnalysis
    lifecycle_history: list[dict[str, Any]] = Field(default_factory=list)


class SystemIncidentRow(GovernanceIdentityMixin):
    lifecycle: str
    severity: str
    priority: str
    title: str
    summary: str
    signal_type: str
    opened_at: datetime
    updated_at: datetime


class SystemTelemetryPoint(BaseModel):
    timestamp: datetime
    latency_ms: float | None = None
    grounding_score: float | None = None
    unsupported_claim_rate: float | None = None
    signal_type: str | None = None
    severity: str | None = None


class SystemControlRow(BaseModel):
    rule_id: str
    signal_type: str
    threshold_field: str
    threshold_value: float
    severity: str
    last_fired_at: datetime | None = None
    open_incident_id: str | None = None
