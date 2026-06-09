from __future__ import annotations

from app.pipeline.adapters.otel_agent import adapt_otel_agent, parse_raw_envelope
from app.pipeline.normalizer import normalize_adapted


def test_normalizer_populates_evaluation_signals():
    raw = {
        "schema_version": "1.0",
        "source_type": "otel_agent_trace",
        "source_provider": "internal",
        "source_service": "agent-orchestrator",
        "tenant_id": "tenant-demo",
        "environment": "production",
        "system_id": "sys-agt-treasury-001",
        "trace_id": "trc_1",
        "span_id": "spn_1",
        "timestamp": "2026-06-02T14:22:01.123Z",
        "operation": "output_evaluation",
        "evaluation": {"grounding_score": 0.5, "unsupported_claim_rate": 0.05},
        "idempotency_key": "k2",
    }
    adapted = adapt_otel_agent(parse_raw_envelope(raw))
    event = normalize_adapted(adapted, raw_event_id="raw-1")
    assert event.evaluation_signals["unsupported_claim_rate"] == 0.05
    assert event.normalized_signal_type == "unsupported_claim_elevated"
    assert event.severity == "critical"
