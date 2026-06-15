"""Trace ID generation and span tree assembly."""

from __future__ import annotations

import random
import secrets
from typing import Any

from app.simulator.models import SimulatedSpan

NS_PER_MS = 1_000_000

# Bumped when trace topology / scoping semantics change (surfaced in simulator status).
TRACE_BUILDER_REVISION = "2026.06.3-healthy-variation"


def trace_id_hex() -> str:
    return secrets.token_hex(16)


def span_id_hex() -> str:
    return secrets.token_hex(8)


def seeded_rng(seed: int) -> random.Random:
    return random.Random(seed)


def ms_to_ns(ms: float) -> int:
    return int(ms * NS_PER_MS)


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
    duration_ns = int(duration_ms * NS_PER_MS)
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


def build_spans_from_specs(
    specs: list[dict[str, Any]],
    *,
    base_ns: int,
    system_id: str,
    build_evaluation,
    build_events,
) -> list[SimulatedSpan]:
    """Build spans from resolved specs with explicit start_offset_ms timing."""
    spans: list[SimulatedSpan] = []
    span_ids: list[str] = []

    for spec in specs:
        parent_id = span_ids[spec["parent_index"]] if spec.get("parent_index") is not None else None
        start_offset_ms = float(spec.get("start_offset_ms", 0))
        start_ns = base_ns + ms_to_ns(start_offset_ms)
        duration_ms = float(spec["duration_ms"])

        attributes: dict[str, Any] = {
            "gen_ai.operation.name": spec.get("operation", spec["name"]),
        }
        if spec.get("parent_index") is None:
            attributes["fleetrac.system.id"] = system_id
        attributes.update(spec.get("attributes") or {})

        evaluation = build_evaluation(spec)
        events = build_events(spec, start_ns, duration_ms)

        sp = span_from_template(
            name=spec["name"],
            kind=spec.get("kind", "INTERNAL"),
            parent_id=parent_id,
            start_ns=start_ns,
            duration_ms=duration_ms,
            operation=spec.get("operation", spec["name"]),
            attributes=attributes,
            events=events,
            evaluation=evaluation,
            policy_result=spec.get("policy_result"),
        )
        spans.append(sp)
        span_ids.append(sp.span_id)

    finalize_root_span_duration(spans, closing_offset_ms=4.0)
    return spans


def finalize_root_span_duration(spans: list[SimulatedSpan], *, closing_offset_ms: float = 4.0) -> None:
    if not spans:
        return
    root = spans[0]
    max_end = max(sp.end_time_unix_nano for sp in spans)
    root.end_time_unix_nano = max_end + ms_to_ns(closing_offset_ms)
    # Wall-clock envelope only — root latency_ms is not model latency.
    if root.name != "agent.request":
        root.latency_ms = (root.end_time_unix_nano - root.start_time_unix_nano) / NS_PER_MS


def span_offset_ms(span: SimulatedSpan, base_ns: int) -> int:
    return int((span.start_time_unix_nano - base_ns) // NS_PER_MS)


def span_end_offset_ms(span: SimulatedSpan, base_ns: int) -> int:
    return int((span.end_time_unix_nano - base_ns) // NS_PER_MS)


def validate_trace_timing(spans: list[SimulatedSpan], base_ns: int) -> list[str]:
    errors: list[str] = []
    if not spans:
        return errors

    by_id = {sp.span_id: sp for sp in spans}
    root = spans[0]

    for sp in spans:
        if sp.end_time_unix_nano < sp.start_time_unix_nano:
            errors.append(f"{sp.name}: end before start")
        if sp.parent_span_id:
            parent = by_id.get(sp.parent_span_id)
            if parent is None:
                errors.append(f"{sp.name}: missing parent")
                continue
            if sp.start_time_unix_nano < parent.start_time_unix_nano:
                errors.append(f"{sp.name}: starts before parent {parent.name}")
            if sp.end_time_unix_nano > parent.end_time_unix_nano:
                errors.append(f"{sp.name}: ends after parent {parent.name}")

    max_end = max(sp.end_time_unix_nano for sp in spans)
    if root.end_time_unix_nano < max_end:
        errors.append("root: does not cover latest descendant")

    for sp in spans:
        if span_offset_ms(sp, base_ns) < 0:
            errors.append(f"{sp.name}: negative start offset")

    return errors


def iso_from_nano(ns: int) -> str:
    from datetime import datetime, timezone

    return datetime.fromtimestamp(ns / 1_000_000_000, tz=timezone.utc).isoformat().replace("+00:00", "Z")
