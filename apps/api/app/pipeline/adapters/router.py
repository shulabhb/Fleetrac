from __future__ import annotations

from typing import Any

from app.pipeline.adapters.otel_agent import OTEL_SOURCE_TYPES, OtelAdapterError, adapt_otel_agent
from app.schemas.ingestion import RawIngestEnvelope

CLOUD_SOURCE_TYPES = frozenset(
    {
        "aws_bedrock_invocation",
        "azure_openai_invocation",
        "vertex_ai_invocation",
        "policy_engine_event",
    }
)


class AdapterError(ValueError):
    pass


def adapt_raw_envelope(envelope: RawIngestEnvelope) -> dict[str, Any]:
    st = envelope.source_type
    data = envelope.model_dump()

    if st in OTEL_SOURCE_TYPES:
        return adapt_otel_agent(envelope)

    if st == "aws_bedrock_invocation":
        return _adapt_aws(data)
    if st == "azure_openai_invocation":
        return _adapt_azure(data)
    if st == "vertex_ai_invocation":
        return _adapt_vertex(data)
    if st == "policy_engine_event":
        return _adapt_policy(data)

    raise AdapterError(f"unsupported source_type: {st}")


def _adapt_aws(data: dict[str, Any]) -> dict[str, Any]:
    safety = data.get("safety") or {}
    tokens = data.get("tokens") or {}
    evaluation: dict[str, float] = {}
    if data.get("latency_ms"):
        evaluation["latency_ms"] = float(data["latency_ms"])
    return {
        "tenant_id": data.get("tenant_id", "tenant-demo"),
        "environment": data.get("environment", "production"),
        "source_provider": "aws",
        "source_service": data.get("source_service", "bedrock"),
        "source_type": "aws_bedrock_invocation",
        "system_id": data["system_id"],
        "trace_id": data.get("trace_id"),
        "span_id": data.get("invocation_id"),
        "operation_type": "model_call",
        "model": data.get("model_id"),
        "tool": None,
        "latency_ms": data.get("latency_ms"),
        "evaluation_signals": evaluation,
        "policy_result": "deny" if safety.get("blocked") else "allow",
        "content_mode": data.get("content_mode", "metadata_only"),
        "payload_hash": data.get("payload_hash"),
        "timestamp": data["timestamp"],
    }


def _adapt_azure(data: dict[str, Any]) -> dict[str, Any]:
    filters = data.get("content_filter_results") or {}
    evaluation: dict[str, float] = {"latency_ms": float(data.get("latency_ms") or 0)}
    if filters.get("tool_scope_violation"):
        evaluation["tool_scope_violation"] = 1.0
    return {
        "tenant_id": data.get("tenant_id", "tenant-demo"),
        "environment": data.get("environment", "production"),
        "source_provider": "azure",
        "source_service": data.get("source_service", "azure-openai"),
        "source_type": "azure_openai_invocation",
        "system_id": data["system_id"],
        "trace_id": data.get("trace_id"),
        "span_id": data.get("invocation_id"),
        "operation_type": data.get("operation", "model_call"),
        "model": data.get("deployment_name"),
        "tool": (data.get("tool") or {}).get("name") if isinstance(data.get("tool"), dict) else None,
        "latency_ms": data.get("latency_ms"),
        "evaluation_signals": evaluation,
        "policy_result": data.get("policy_result", "allow"),
        "content_mode": data.get("content_mode", "metadata_only"),
        "payload_hash": data.get("payload_hash"),
        "timestamp": data["timestamp"],
    }


def _adapt_vertex(data: dict[str, Any]) -> dict[str, Any]:
    evaluation = dict(data.get("evaluation") or {})
    if data.get("latency_ms"):
        evaluation["latency_ms"] = float(data["latency_ms"])
    return {
        "tenant_id": data.get("tenant_id", "tenant-demo"),
        "environment": data.get("environment", "production"),
        "source_provider": "gcp",
        "source_service": data.get("source_service", "vertex-ai"),
        "source_type": "vertex_ai_invocation",
        "system_id": data["system_id"],
        "trace_id": data.get("trace_id"),
        "span_id": data.get("invocation_id"),
        "operation_type": "model_call",
        "model": data.get("model_version") or data.get("endpoint_id"),
        "tool": None,
        "latency_ms": data.get("latency_ms"),
        "evaluation_signals": evaluation,
        "policy_result": "allow",
        "content_mode": data.get("content_mode", "metadata_only"),
        "payload_hash": data.get("payload_hash"),
        "timestamp": data["timestamp"],
    }


def _adapt_policy(data: dict[str, Any]) -> dict[str, Any]:
    evaluation: dict[str, float] = {}
    if data.get("tool_scope_violation"):
        evaluation["tool_scope_violation"] = 1.0
    return {
        "tenant_id": data.get("tenant_id", "tenant-demo"),
        "environment": data.get("environment", "production"),
        "source_provider": data.get("source_provider", "internal"),
        "source_service": "policy-engine",
        "source_type": "policy_engine_event",
        "system_id": data["system_id"],
        "trace_id": data.get("trace_id"),
        "span_id": data.get("event_id"),
        "operation_type": data.get("operation", "policy_eval"),
        "model": None,
        "tool": (data.get("tool") or {}).get("name") if isinstance(data.get("tool"), dict) else None,
        "latency_ms": data.get("latency_ms"),
        "evaluation_signals": evaluation,
        "policy_result": data.get("result", "deny"),
        "content_mode": data.get("content_mode", "metadata_only"),
        "payload_hash": data.get("payload_hash"),
        "timestamp": data["timestamp"],
    }
