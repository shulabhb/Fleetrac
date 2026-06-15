"""Healthy trace bundle generation for all fleet systems."""

from __future__ import annotations

from typing import Any

from app.fleet.registry import FLEET_SYSTEMS
from app.simulator.engine import make_run_context, run_agent
from app.simulator.telemetry.serializer import trace_to_v2_bundle


def healthy_trace_bundle(
    system_id: str,
    *,
    seed: int,
    seq: int = 0,
    simulator_run_id: str | None = None,
) -> dict[str, Any]:
    ctx = make_run_context(seed=seed + seq, system_id=system_id, simulator_run_id=simulator_run_id)
    trace = run_agent(system_id, None, ctx)
    return trace_to_v2_bundle(
        trace,
        ctx=ctx,
        idempotency_key=f"{system_id}:healthy:{seed}:{seq}",
    )


def healthy_baseline_event(system_id: str, *, seq: int, seed: int = 42) -> dict[str, Any]:
    """Backward-compatible name — returns v2 bundle."""
    return healthy_trace_bundle(system_id, seed=seed, seq=seq)


def healthy_baseline_batch(system_ids: list[str], count: int = 10, *, seed: int = 42) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    for i in range(count):
        sid = system_ids[i % len(system_ids)]
        events.append(healthy_baseline_event(sid, seq=i, seed=seed))
    return events


def all_fleet_system_ids() -> list[str]:
    return [s.id for s in FLEET_SYSTEMS]
