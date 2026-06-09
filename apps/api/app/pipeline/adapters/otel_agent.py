from __future__ import annotations

from typing import Any

from app.schemas.ingestion import RawOtelEnvelope


OTEL_SOURCE_TYPES = frozenset(
    {"otel_agent_trace", "langgraph_trace", "custom_agent_trace"}
)


class OtelAdapterError(ValueError):
    pass


def parse_raw_envelope(data: dict[str, Any]) -> RawOtelEnvelope:
    return RawOtelEnvelope.model_validate(data)


def adapt_otel_agent(envelope: RawOtelEnvelope) -> dict[str, Any]:
    if envelope.source_type not in OTEL_SOURCE_TYPES:
        raise OtelAdapterError(f"unsupported source_type: {envelope.source_type}")

    model_name = None
    if envelope.model:
        model_name = envelope.model.get("name") or envelope.model.get("model_id")

    tool_name = None
    if envelope.tool:
        tool_name = envelope.tool.get("name")

    policy_result = None
    if envelope.policy:
        policy_result = envelope.policy.get("result")

    return {
        "tenant_id": envelope.tenant_id,
        "environment": envelope.environment,
        "source_provider": envelope.source_provider,
        "source_service": envelope.source_service,
        "source_type": envelope.source_type,
        "system_id": envelope.system_id,
        "trace_id": envelope.trace_id,
        "span_id": envelope.span_id,
        "operation_type": envelope.operation,
        "model": model_name,
        "tool": tool_name,
        "latency_ms": envelope.latency_ms,
        "evaluation_signals": dict(envelope.evaluation or {}),
        "policy_result": policy_result,
        "content_mode": envelope.content_mode,
        "payload_hash": envelope.payload_hash,
        "timestamp": envelope.timestamp,
        "agent_step": envelope.agent_step,
    }
