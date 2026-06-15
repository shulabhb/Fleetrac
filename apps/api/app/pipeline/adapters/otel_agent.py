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


def adapt_v2_span(
    bundle: dict[str, Any],
    span: dict[str, Any],
    *,
    timestamp: str,
) -> dict[str, Any]:
    """Map a v2 bundle span to the adapted dict consumed by the normalizer."""
    evaluation = dict(span.get("evaluation") or {})
    for key, value in (span.get("attributes") or {}).items():
        if key.startswith("fleetrac.evaluation."):
            try:
                evaluation[key.replace("fleetrac.evaluation.", "")] = float(value)
            except (TypeError, ValueError):
                evaluation[key.replace("fleetrac.evaluation.", "")] = value

    latency = span.get("latency_ms")
    if latency is not None:
        evaluation.setdefault("latency_ms", float(latency))

    attrs = span.get("attributes") or {}
    model_name = attrs.get("gen_ai.request.model") or attrs.get("gen_ai.response.model")
    tool_name = attrs.get("gen_ai.tool.name")

    return {
        "tenant_id": bundle.get("tenant_id", "tenant-demo"),
        "environment": bundle.get("environment", "production"),
        "source_provider": "internal",
        "source_service": "agent-orchestrator",
        "source_type": bundle.get("source_type", "otel_agent_trace"),
        "system_id": bundle["system_id"],
        "trace_id": bundle["trace_id"],
        "span_id": span["span_id"],
        "parent_span_id": span.get("parent_span_id"),
        "span_name": span.get("name"),
        "operation_type": span.get("operation") or span.get("name", "agent_step"),
        "model": str(model_name) if model_name else None,
        "tool": str(tool_name) if tool_name else None,
        "latency_ms": latency,
        "evaluation_signals": evaluation,
        "policy_result": span.get("policy_result"),
        "content_mode": bundle.get("content_mode", "metadata_only"),
        "payload_hash": bundle.get("payload_hash"),
        "timestamp": timestamp,
        "agent_step": span.get("name"),
    }
