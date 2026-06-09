"""Deterministic tool scope violation — Security Operations pitch scenario."""

from __future__ import annotations

from typing import Any

from app.simulator.system_profiles import build_raw_envelope


def tool_scope_violation_sequence(system_id: str = "sys-agt-cs-002") -> list[dict[str, Any]]:
    trace = "trc-tool-scope-001"
    return [
        build_raw_envelope(
            system_id,
            seq=1,
            source_type="langgraph_trace",
            trace_id=trace,
            operation="agent_step",
            evaluation={"routing_confidence": 0.91},
            extra={"idempotency_key": f"langgraph:{trace}:spn-ts-1"},
        ),
        build_raw_envelope(
            system_id,
            seq=2,
            source_type="azure_openai_invocation",
            trace_id=trace,
            extra={"idempotency_key": f"azure:Invoke:{trace}:az-inv-1"},
        ),
        build_raw_envelope(
            system_id,
            seq=3,
            source_type="langgraph_trace",
            trace_id=trace,
            operation="tool_call",
            evaluation={"tool_scope_violation": 1.0},
            extra={
                "tool": {"name": "refund_api_execute", "approved": False},
                "policy": {"result": "deny", "rule_ids": ["ctrl-tool-001"]},
                "idempotency_key": f"langgraph:{trace}:spn-ts-2",
            },
        ),
        build_raw_envelope(
            system_id,
            seq=4,
            source_type="policy_engine_event",
            trace_id=trace,
            operation="policy_eval",
            extra={
                "event_id": "pol-1",
                "result": "deny",
                "tool": {"name": "refund_api_execute"},
                "tool_scope_violation": True,
                "idempotency_key": f"policy:{trace}:pol-1",
            },
        ),
    ]
