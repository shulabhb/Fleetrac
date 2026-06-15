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
    evaluation: dict[str, Any] = {}
    attrs = span.get("attributes") or {}
    for key, value in attrs.items():
        if key.startswith("fleetrac.evaluation."):
            eval_key = key.replace("fleetrac.evaluation.", "")
            try:
                evaluation[eval_key] = float(value)
            except (TypeError, ValueError):
                evaluation[eval_key] = value
    evaluation.update(span.get("evaluation") or {})

    span_latency = span.get("latency_ms")
    start_ns = span.get("start_time_unix_nano")
    end_ns = span.get("end_time_unix_nano")
    span_duration_ms: float | None = None
    if start_ns is not None and end_ns is not None:
        span_duration_ms = (int(end_ns) - int(start_ns)) / 1_000_000

    span_name = span.get("name")
    operation = span.get("operation") or span_name or "agent_step"
    # Provider/operation latency is distinct from wall-clock span envelope duration.
    operation_latency_ms: float | None = None
    if span_name != "agent.request" and operation in ("model_call", "tool_call", "retrieval"):
        operation_latency_ms = evaluation.get("latency_ms")
        if operation_latency_ms is None and span_latency is not None:
            operation_latency_ms = float(span_latency)
    elif evaluation.get("latency_ms") is not None and span_name != "agent.request":
        operation_latency_ms = float(evaluation["latency_ms"])

    if span_duration_ms is not None:
        evaluation["span_duration_ms"] = span_duration_ms
    if operation_latency_ms is not None:
        evaluation["operation_latency_ms"] = operation_latency_ms

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
        "span_name": span_name,
        "operation_type": operation,
        "model": str(model_name) if model_name else None,
        "tool": str(tool_name) if tool_name else None,
        "latency_ms": operation_latency_ms,
        "evaluation_signals": evaluation,
        "policy_result": span.get("policy_result"),
        "content_mode": bundle.get("content_mode", "metadata_only"),
        "payload_hash": bundle.get("payload_hash"),
        "timestamp": timestamp,
        "agent_step": span_name,
    }
