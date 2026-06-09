"""Healthy baseline events across fleet systems — model-aligned per registry profile."""

from __future__ import annotations

from typing import Any

from app.fleet.registry import FLEET_SYSTEMS
from app.simulator.system_profiles import build_raw_envelope, primary_source_type


def healthy_baseline_event(
    system_id: str,
    *,
    seq: int,
    source_type: str | None = None,
) -> dict[str, Any]:
    st = source_type or primary_source_type(system_id)
    return build_raw_envelope(system_id, seq=seq, source_type=st)


def healthy_baseline_batch(system_ids: list[str], count: int = 10) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    for i in range(count):
        sid = system_ids[i % len(system_ids)]
        events.append(healthy_baseline_event(sid, seq=i))
    return events


def all_fleet_system_ids() -> list[str]:
    return [s.id for s in FLEET_SYSTEMS]
