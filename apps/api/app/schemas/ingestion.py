from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class RawOtelEnvelope(BaseModel):
    """OpenTelemetry-style agent trace envelope."""

    schema_version: str = "1.0"
    source_type: str = Field(..., description="otel_agent_trace | langgraph_trace | custom_agent_trace")
    source_provider: str = "internal"
    source_service: str = "agent-orchestrator"
    tenant_id: str = "tenant-demo"
    environment: str = "production"
    system_id: str
    trace_id: str
    span_id: str
    parent_span_id: str | None = None
    timestamp: str
    operation: str
    agent_step: str | None = None
    model: dict[str, Any] | None = None
    tool: dict[str, Any] | None = None
    latency_ms: float | None = None
    tokens: dict[str, int] | None = None
    evaluation: dict[str, float] | None = None
    policy: dict[str, Any] | None = None
    status: str = "ok"
    error: str | None = None
    classification: dict[str, Any] | None = None
    deployment: dict[str, Any] | None = None
    content_mode: str = "metadata_only"
    payload_hash: str | None = None
    idempotency_key: str

    model_config = {"extra": "allow"}


class RawIngestEnvelope(BaseModel):
    """Unified ingest envelope — OTEL, cloud invocations, policy events."""

    schema_version: str = "1.0"
    source_type: str
    source_provider: str = "internal"
    source_service: str = "unknown"
    tenant_id: str = "tenant-demo"
    environment: str = "production"
    system_id: str
    trace_id: str | None = None
    span_id: str | None = None
    invocation_id: str | None = None
    timestamp: str
    operation: str = "model_call"
    idempotency_key: str
    agent_step: str | None = None
    model: dict[str, Any] | None = None
    tool: dict[str, Any] | None = None
    latency_ms: float | None = None
    evaluation: dict[str, float] | None = None
    policy: dict[str, Any] | None = None
    policy_result: str | None = None
    content_mode: str = "metadata_only"
    payload_hash: str | None = None

    model_config = {"extra": "allow"}


class IngestBatchRequest(BaseModel):
    events: list[dict[str, Any]] = Field(..., max_length=100)


class IngestBatchResponse(BaseModel):
    accepted: int
    duplicates: int
    failures: list[dict[str, Any]] = Field(default_factory=list)


class IngestEventResponse(BaseModel):
    raw_event_id: str
    event_id: str
    duplicate: bool = False
    incident_id: str | None = None
    normalized_signal_type: str | None = None
    spans_accepted: int = 1
    warnings: list[str] = Field(default_factory=list)


class OtelSpanStatus(BaseModel):
    code: str = "OK"
    message: str | None = None


class OtelSpanEvent(BaseModel):
    name: str
    time_unix_nano: int
    attributes: dict[str, Any] = Field(default_factory=dict)


class OtelSpan(BaseModel):
    span_id: str
    parent_span_id: str | None = None
    name: str
    kind: str = "INTERNAL"
    start_time_unix_nano: int
    end_time_unix_nano: int
    status: OtelSpanStatus = Field(default_factory=OtelSpanStatus)
    attributes: dict[str, Any] = Field(default_factory=dict)
    events: list[OtelSpanEvent] = Field(default_factory=list)


class OtelResource(BaseModel):
    attributes: dict[str, Any] = Field(default_factory=dict)


class OtelInstrumentationScope(BaseModel):
    name: str = "fleetrac.agent-simulator"
    version: str = "2026.06.1"
    schema_url: str | None = None
    attributes: dict[str, Any] = Field(default_factory=dict)


class OtelTraceBundle(BaseModel):
    """schema_version 2.0 nested trace bundle — source_type remains otel_agent_trace."""

    schema_version: str = "2.0"
    source_type: str = "otel_agent_trace"
    tenant_id: str = "tenant-demo"
    environment: str = "production"
    system_id: str
    content_mode: str = "metadata_only"
    idempotency_key: str
    payload_hash: str | None = None
    trace_id: str
    resource: OtelResource
    instrumentation_scope: OtelInstrumentationScope
    spans: list[OtelSpan]
    logs: list[dict[str, Any]] = Field(default_factory=list)
    metrics: list[dict[str, Any]] = Field(default_factory=list)
    scenario: dict[str, Any] | None = None

    model_config = {"extra": "allow"}
