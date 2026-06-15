"""Trace ID generation and span tree assembly."""

from __future__ import annotations

import random
import secrets
from typing import Any

from app.simulator.models import SimulatedSpan


def trace_id_hex() -> str:
    return secrets.token_hex(16)


def span_id_hex() -> str:
    return secrets.token_hex(8)


def seeded_rng(seed: int) -> random.Random:
    return random.Random(seed)


def span_from_template(
    *,
    name: str,
    kind: str,
    parent_id: str | None,
    start_ns: int,
    duration_ms: float,
    operation: str,
    attributes: dict[str, Any] | None = None,
    events: list[dict[str, Any]] | None = None,
    evaluation: dict[str, float] | None = None,
    policy_result: str | None = None,
) -> SimulatedSpan:
    duration_ns = int(duration_ms * 1_000_000)
    end_ns = start_ns + duration_ns
    return SimulatedSpan(
        span_id=span_id_hex(),
        parent_span_id=parent_id,
        name=name,
        kind=kind,
        start_time_unix_nano=start_ns,
        end_time_unix_nano=end_ns,
        attributes=dict(attributes or {}),
        events=list(events or []),
        operation=operation,
        evaluation=dict(evaluation or {}),
        policy_result=policy_result,
        latency_ms=duration_ms,
    )


def iso_from_nano(ns: int) -> str:
    from datetime import datetime, timezone

    return datetime.fromtimestamp(ns / 1_000_000_000, tz=timezone.utc).isoformat().replace("+00:00", "Z")
