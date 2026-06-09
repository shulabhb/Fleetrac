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
    normalized_signal_type: str | None = None
    severity: str
    confidence: float
    incident_id: str | None = None
    trace_id: str | None = None
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
    severity: str
    normalized_signal_type: str | None = None
    incident_id: str | None = None
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


class IngestLogResponse(BaseModel):
    items: list[IngestLogRow]
    total: int


class OwnerQueueRow(GovernanceIdentityMixin):
    lifecycle: str
    classification_category: str
    severity: str
    priority: str
    owner_team: str
    title: str
    summary: str
    reviewer: str | None = None
    opened_at: datetime
    updated_at: datetime


class OwnerQueueResponse(BaseModel):
    items: list[OwnerQueueRow]
    total: int


class EvidenceItemDTO(BaseModel):
    id: str
    kind: str
    reference_id: str
    summary: str
    created_at: datetime


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
