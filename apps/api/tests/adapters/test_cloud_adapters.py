from __future__ import annotations

from app.pipeline.adapters.router import adapt_raw_envelope
from app.schemas.ingestion import RawIngestEnvelope


def _envelope(payload: dict) -> RawIngestEnvelope:
    return RawIngestEnvelope.model_validate(payload)


def test_adapt_aws_bedrock_invocation():
    adapted = adapt_raw_envelope(
        _envelope(
            {
                "schema_version": "1.0",
                "source_type": "aws_bedrock_invocation",
                "source_provider": "aws",
                "source_service": "bedrock",
                "tenant_id": "tenant-demo",
                "environment": "production",
                "system_id": "sys-agt-refund-001",
                "invocation_id": "aws-br-test",
                "trace_id": "trc-aws",
                "timestamp": "2026-06-02T14:22:02Z",
                "model_id": "anthropic.claude-3-5-sonnet",
                "latency_ms": 1204,
                "safety": {"blocked": False},
                "idempotency_key": "aws:test:1",
            }
        )
    )
    assert adapted["source_provider"] == "aws"
    assert adapted["source_type"] == "aws_bedrock_invocation"
    assert adapted["operation_type"] == "model_call"
    assert adapted["policy_result"] == "allow"


def test_adapt_azure_openai_tool_scope():
    adapted = adapt_raw_envelope(
        _envelope(
            {
                "schema_version": "1.0",
                "source_type": "azure_openai_invocation",
                "source_provider": "azure",
                "source_service": "azure-openai",
                "tenant_id": "tenant-demo",
                "environment": "production",
                "system_id": "sys-agt-cs-002",
                "invocation_id": "az-test",
                "trace_id": "trc-az",
                "timestamp": "2026-06-02T14:22:03Z",
                "deployment_name": "gpt-4o",
                "latency_ms": 380,
                "content_filter_results": {"tool_scope_violation": True},
                "idempotency_key": "azure:test:1",
            }
        )
    )
    assert adapted["source_provider"] == "azure"
    assert adapted["evaluation_signals"]["tool_scope_violation"] == 1.0


def test_adapt_vertex_ai_invocation():
    adapted = adapt_raw_envelope(
        _envelope(
            {
                "schema_version": "1.0",
                "source_type": "vertex_ai_invocation",
                "source_provider": "gcp",
                "source_service": "vertex-ai",
                "tenant_id": "tenant-demo",
                "environment": "production",
                "system_id": "sys-agt-pep-003",
                "invocation_id": "vertex-test",
                "trace_id": "trc-gcp",
                "timestamp": "2026-06-02T14:22:04Z",
                "model_version": "gemini-1.5-pro",
                "latency_ms": 410,
                "evaluation": {"grounding_score": 0.91},
                "idempotency_key": "gcp:test:1",
            }
        )
    )
    assert adapted["source_provider"] == "gcp"
    assert adapted["evaluation_signals"]["grounding_score"] == 0.91
