from __future__ import annotations

from app.pipeline.adapters.otel_agent import adapt_otel_agent, parse_raw_envelope
from app.slice_a.constants import SYSTEM_ID


def test_otel_agent_parses_required_fields():
    raw = {
        "schema_version": "1.0",
        "source_type": "langgraph_trace",
        "source_provider": "internal",
        "source_service": "agent-orchestrator",
        "tenant_id": "tenant-demo",
        "environment": "production",
        "system_id": SYSTEM_ID,
        "trace_id": "trc_1",
        "span_id": "spn_1",
        "timestamp": "2026-06-02T14:22:01.123Z",
        "operation": "model_call",
        "evaluation": {"grounding_score": 0.8},
        "idempotency_key": "k1",
    }
    envelope = parse_raw_envelope(raw)
    adapted = adapt_otel_agent(envelope)
    assert adapted["system_id"] == SYSTEM_ID
    assert adapted["operation_type"] == "model_call"
    assert adapted["evaluation_signals"]["grounding_score"] == 0.8
    assert adapted["trace_id"] == "trc_1"
