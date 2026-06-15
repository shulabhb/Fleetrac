"""Scenario sequence builders using v2 trace bundles."""

from __future__ import annotations

from typing import Any

from app.simulator.engine import make_run_context, run_agent
from app.simulator.telemetry.serializer import trace_to_v2_bundle


def scenario_trace_bundle(
    system_id: str,
    scenario_id: str,
    *,
    seed: int = 42,
    seq: int = 0,
    impact_mode: str | None = None,
) -> dict[str, Any]:
    ctx = make_run_context(
        seed=seed,
        scenario_id=scenario_id,
        system_id=system_id,
        impact_mode=impact_mode,
    )
    trace = run_agent(system_id, scenario_id, ctx, impact_mode=impact_mode)
    return trace_to_v2_bundle(
        trace,
        ctx=ctx,
        idempotency_key=f"{system_id}:{scenario_id}:{seed}:{seq}",
    )


def unsupported_claim_spike_sequence(
    system_id: str | None = None,
    impact_mode: str | None = None,
) -> list[dict[str, Any]]:
    sid = system_id or "sys-agt-treasury-001"
    return [scenario_trace_bundle(sid, "unsupported_claim_spike", seed=42, impact_mode=impact_mode)]


def tool_scope_violation_sequence(
    system_id: str = "sys-agt-phish-008",
    impact_mode: str | None = None,
) -> list[dict[str, Any]]:
    return [scenario_trace_bundle(system_id, "tool_scope_violation", seed=43, impact_mode=impact_mode)]


def provider_latency_regression_sequence(
    system_id: str = "sys-agt-cs-002",
    impact_mode: str | None = None,
) -> list[dict[str, Any]]:
    return [scenario_trace_bundle(system_id, "provider_latency_regression", seed=44, impact_mode=impact_mode)]
