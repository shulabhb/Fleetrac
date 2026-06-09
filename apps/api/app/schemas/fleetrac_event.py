from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class FleetracEvent(BaseModel):
    event_id: str
    timestamp: datetime
    tenant_id: str
    environment: Literal["staging", "production"]
    source_provider: str
    source_service: str
    source_type: str
    system_id: str
    trace_id: str | None = None
    span_id: str | None = None
    operation_type: str
    model: str | None = None
    tool: str | None = None
    latency_ms: float | None = None
    evaluation_signals: dict[str, Any] = Field(default_factory=dict)
    policy_result: str | None = None
    normalized_signal_type: str | None = None
    severity: Literal["low", "medium", "high", "critical"] = "low"
    confidence: float = 0.0
    evidence_reference: str | None = None
    raw_payload_reference: str
    owner_team: str | None = None
    applicable_control_ids: list[str] = Field(default_factory=list)
    correlation_key: str
    incident_id: str | None = None
    content_mode: Literal["metadata_only", "redacted", "evidence_reference"] = "metadata_only"
    payload_hash: str | None = None
