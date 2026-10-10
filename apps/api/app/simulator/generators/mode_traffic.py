"""Mode-aware bundle emission for continuous runner story phases.

Reuses healthy + scenario mutation path — no parallel generator.
"""

from __future__ import annotations

from typing import Any

from app.simulator.engine import make_run_context, run_agent
from app.simulator.telemetry.serializer import trace_to_v2_bundle


def emit_bundle(
    system_id: str,
    *,
    mode: str,
    seed: int,
    seq: int,
    simulator_run_id: str | None = None,
    mutation_id: str | None = None,
    impact_mode: str | None = None,
) -> dict[str, Any]:
    """
    mode:
      baseline | degradation | incident_window | post_action_verification |
      recovery | regression
    """
    scenario_id: str | None = None
    resolved_impact = impact_mode

    if mode == "baseline" or mode == "recovery" or mode == "post_action_verification":
        scenario_id = None
    elif mode in ("degradation", "near_miss"):
        scenario_id = "near_miss" if mode == "near_miss" else "soft_degradation"
    elif mode in ("incident_window", "regression"):
        scenario_id = mutation_id or "unsupported_claim_spike"
        if resolved_impact is None:
            resolved_impact = "degraded" if mode == "regression" else None

    ctx = make_run_context(
        seed=seed + seq,
        scenario_id=scenario_id,
        system_id=system_id,
        simulator_run_id=simulator_run_id,
        impact_mode=resolved_impact,
    )
    trace = run_agent(system_id, scenario_id, ctx, impact_mode=resolved_impact)
    key_mode = mode if mode != "baseline" else "healthy"
    return trace_to_v2_bundle(
        trace,
        ctx=ctx,
        idempotency_key=f"{system_id}:{key_mode}:{seed}:{seq}",
    )
