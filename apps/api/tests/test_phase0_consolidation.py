"""Tests for ingest unknown_system rejection and healthy signal neutrality."""

from __future__ import annotations

from app.pipeline.adapters.otel_agent import adapt_otel_agent, parse_raw_envelope
from app.pipeline.normalizer import normalize_adapted


def test_healthy_event_has_null_severity_and_confidence():
    raw = {
        "schema_version": "1.0",
        "source_type": "otel_agent_trace",
        "source_provider": "internal",
        "source_service": "agent-orchestrator",
        "tenant_id": "tenant-demo",
        "environment": "production",
        "system_id": "sys-agt-treasury-001",
        "trace_id": "a" * 32,
        "span_id": "b" * 16,
        "timestamp": "2026-06-02T14:22:01.123Z",
        "operation": "model_call",
        "evaluation": {"grounding_score": 0.88, "unsupported_claim_rate": 0.01},
        "idempotency_key": "healthy-1",
    }
    adapted = adapt_otel_agent(parse_raw_envelope(raw))
    event = normalize_adapted(adapted, raw_event_id="raw-healthy")
    assert event.signal_state == "healthy"
    assert event.normalized_signal_type is None
    assert event.severity is None
    assert event.confidence is None


def test_grounding_degraded_signal_type_aligns_with_rule():
    raw = {
        "schema_version": "1.0",
        "source_type": "otel_agent_trace",
        "source_provider": "internal",
        "source_service": "agent-orchestrator",
        "tenant_id": "tenant-demo",
        "environment": "production",
        "system_id": "sys-agt-pep-003",
        "trace_id": "c" * 32,
        "span_id": "d" * 16,
        "timestamp": "2026-06-02T14:22:01.123Z",
        "operation": "output_evaluation",
        "evaluation": {"grounding_score": 0.65},
        "idempotency_key": "grounding-1",
    }
    adapted = adapt_otel_agent(parse_raw_envelope(raw))
    event = normalize_adapted(adapted, raw_event_id="raw-g")
    assert event.normalized_signal_type == "grounding_degraded"
    assert event.signal_state == "warning"
    assert event.severity == "high"


def test_unknown_system_returns_422(client):
    payload = {
        "schema_version": "1.0",
        "source_type": "otel_agent_trace",
        "system_id": "sys-unknown-999",
        "tenant_id": "tenant-demo",
        "environment": "production",
        "timestamp": "2026-06-02T14:22:01.123Z",
        "idempotency_key": "unknown-sys-1",
    }
    response = client.post("/api/v1/ingest/events", json=payload)
    assert response.status_code == 422
    body = response.json()
    detail = body.get("detail")
    if isinstance(detail, dict):
        assert detail.get("error_code") == "unknown_system"
    else:
        assert "unknown_system" in str(detail)
