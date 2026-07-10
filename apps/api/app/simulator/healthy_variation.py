"""Bounded deterministic variation for healthy OTEL traces."""

from __future__ import annotations

import copy
from typing import Any

from app.fleet.registry import FleetSystem

# Per-system model/provider latency ranges (ms) — stay below 800 detection threshold.
MODEL_LATENCY_RANGES: dict[str, tuple[float, float]] = {
    "sys-agt-treasury-001": (340, 480),
    "sys-agt-rag-007": (380, 560),
    "sys-agt-reg-010": (360, 540),
    "sys-agt-cs-002": (320, 520),
    "sys-agt-refund-001": (300, 470),
    "sys-agt-pep-003": (320, 480),
    "sys-agt-access-009": (300, 460),
    "sys-agt-kyc-004": (330, 520),
    "sys-agt-inv-005": (380, 620),
    "sys-agt-phish-008": (300, 500),
}

TOKEN_INPUT_RANGE = (850, 1550)
TOKEN_OUTPUT_RANGE = (100, 280)

GROUNDING_RANGE = (0.82, 0.90)
UNSUPPORTED_CLAIM_RANGE = (0.005, 0.018)
RETRIEVAL_CONFIDENCE_RANGE = (0.86, 0.95)
RETRIEVAL_FAILURE_RANGE = (0.005, 0.025)
DOCUMENT_COUNT_RANGE = (8, 16)
OCR_CONFIDENCE_RANGE = (0.88, 0.96)
FIELD_VALIDATION_RANGE = (0.86, 0.94)
THREAT_ANOMALY_RANGE = (0.03, 0.18)

# Retrieval latency band around each system's baseline (ms).
RETRIEVAL_LATENCY_BAND: dict[str, tuple[float, float]] = {
    "sys-agt-treasury-001": (160, 240),
    "sys-agt-rag-007": (200, 320),
    "sys-agt-reg-010": (180, 280),
}

HEALTHY_OUTCOMES: dict[str, tuple[str, ...]] = {
    "sys-agt-treasury-001": ("published", "held_for_review", "draft_completed"),
    "sys-agt-rag-007": ("answered", "answered_with_citations", "escalated_to_source_owner"),
    "sys-agt-reg-010": ("assessed", "no_material_change", "review_requested"),
    "sys-agt-refund-001": ("approved", "rejected_by_policy", "escalated_for_approval"),
    "sys-agt-pep-003": ("screened", "no_match", "reviewer_review_required"),
    "sys-agt-access-009": ("reviewed", "no_change", "approval_required"),
    "sys-agt-kyc-004": ("written", "review_required", "validation_complete"),
    "sys-agt-inv-005": ("written", "approval_recommended", "manual_review_required"),
    "sys-agt-phish-008": ("quarantined", "released", "escalated"),
    "sys-agt-cs-002": ("queued", "routed", "escalated"),
}

# Insert wait span when gap between `after` and `before` exceeds `min_gap_ms`.
WAIT_GAP_RULES: dict[str, list[dict[str, Any]]] = {
    "sys-agt-refund-001": [
        {
            "after": "model.reasoning",
            "before": "approval_threshold.evaluate",
            "wait_name": "approval.wait",
            "min_gap_ms": 80,
            "duration_ms": ("uniform", 50, 140),
        },
    ],
    "sys-agt-access-009": [
        {
            "after": "model.reasoning",
            "before": "access_change.prepare",
            "wait_name": "approval.wait",
            "min_gap_ms": 80,
            "duration_ms": ("uniform", 45, 130),
        },
    ],
    "sys-agt-pep-003": [
        {
            "after": "model.reasoning",
            "before": "business.outcome",
            "wait_name": "reviewer.wait",
            "min_gap_ms": 60,
            "duration_ms": ("uniform", 40, 120),
        },
    ],
    "sys-agt-kyc-004": [
        {
            "after": "model.review",
            "before": "business.outcome",
            "wait_name": "downstream_write.wait",
            "min_gap_ms": 80,
            "duration_ms": ("uniform", 50, 130),
        },
    ],
    "sys-agt-inv-005": [
        {
            "after": "model.review",
            "before": "business.outcome",
            "wait_name": "downstream_write.wait",
            "min_gap_ms": 80,
            "duration_ms": ("uniform", 50, 130),
        },
    ],
    "sys-agt-reg-010": [
        {
            "after": "model.summarize",
            "before": "citation.verify",
            "wait_name": "review.wait",
            "min_gap_ms": 100,
            "duration_ms": ("uniform", 60, 160),
        },
    ],
}


def sample_bounded(rng, low: float, high: float, *, decimals: int = 3) -> float:
    value = rng.uniform(low, high)
    if decimals == 0:
        return float(int(round(value)))
    return round(value, decimals)


def model_latency_ms(system_id: str, rng) -> float:
    low, high = MODEL_LATENCY_RANGES.get(system_id, (320, 480))
    return sample_bounded(rng, low, high, decimals=1)


def choose_healthy_outcome(system_id: str, rng) -> str:
    options = HEALTHY_OUTCOMES.get(system_id, ("completed",))
    idx = rng.randint(0, len(options) - 1)
    return options[idx]


def apply_healthy_outcome_to_specs(specs: list[dict[str, Any]], system_id: str, rng) -> None:
    outcome = choose_healthy_outcome(system_id, rng)
    for spec in specs:
        if spec.get("operation") == "business.outcome" or spec.get("name") == "business.outcome":
            attrs = dict(spec.get("attributes") or {})
            attrs["fleetrac.business_outcome.status"] = outcome
            spec["attributes"] = attrs
            break


def evaluation_for_key_healthy(key: str | None, system: FleetSystem, rng) -> dict[str, float]:
    sid = system.id
    if key == "grounding":
        return {"grounding_score": sample_bounded(rng, *GROUNDING_RANGE)}
    if key == "unsupported_claims":
        return {"unsupported_claim_rate": sample_bounded(rng, *UNSUPPORTED_CLAIM_RANGE, decimals=4)}
    if key == "ocr":
        return {"ocr_confidence": sample_bounded(rng, *OCR_CONFIDENCE_RANGE)}
    if key == "field_validation":
        return {"field_validation_confidence": sample_bounded(rng, *FIELD_VALIDATION_RANGE)}
    if key == "threat":
        return {"security_anomaly_score": sample_bounded(rng, *THREAT_ANOMALY_RANGE)}
    if key == "model_call":
        return {
            "latency_ms": model_latency_ms(sid, rng),
            "input_tokens": sample_bounded(rng, *TOKEN_INPUT_RANGE, decimals=0),
            "output_tokens": sample_bounded(rng, *TOKEN_OUTPUT_RANGE, decimals=0),
        }
    if key == "retrieval":
        band = RETRIEVAL_LATENCY_BAND.get(sid, (150, 280))
        baseline = float(system.baseline_metrics.get("latency_ms", 220))
        low = max(band[0], baseline * 0.65)
        high = min(band[1], baseline * 1.35)
        if low >= high:
            low, high = band
        return {
            "retrieval_latency_ms": sample_bounded(rng, low, high, decimals=1),
            "document_count": sample_bounded(rng, *DOCUMENT_COUNT_RANGE, decimals=0),
            "retrieval_confidence": sample_bounded(rng, *RETRIEVAL_CONFIDENCE_RANGE),
            "retrieval_failure_rate": sample_bounded(rng, *RETRIEVAL_FAILURE_RANGE, decimals=4),
        }
    return {}


def resolve_healthy_duration(spec: dict[str, Any], system: FleetSystem, rng) -> float:
    raw = spec.get("duration_ms")
    if raw == "baseline_latency":
        return model_latency_ms(system.id, rng)
    if isinstance(raw, tuple) and raw[0] == "uniform":
        return rng.uniform(raw[1], raw[2])
    if raw is None:
        return rng.uniform(40, 200)
    return float(raw)


def _span_end_ms(spec: dict[str, Any]) -> float:
    return float(spec.get("start_offset_ms", 0)) + float(spec["duration_ms"])


def _resolve_wait_duration(rule: dict[str, Any], rng) -> float:
    raw = rule.get("duration_ms")
    if isinstance(raw, tuple) and raw[0] == "uniform":
        return rng.uniform(raw[1], raw[2])
    return float(raw or 80)


def _shift_following_offsets(specs: list[dict[str, Any]], from_index: int, delta_ms: float) -> None:
    if delta_ms <= 0:
        return
    for spec in specs[from_index:]:
        spec["start_offset_ms"] = float(spec.get("start_offset_ms", 0)) + delta_ms


def apply_wait_spans(specs: list[dict[str, Any]], system_id: str, rng) -> list[dict[str, Any]]:
    rules = WAIT_GAP_RULES.get(system_id, [])
    if not rules:
        return specs

    by_name = {spec["name"]: i for i, spec in enumerate(specs)}
    out = list(specs)
    inserted = 0

    for rule in rules:
        after_name = rule["after"]
        before_name = rule["before"]
        if after_name not in by_name or before_name not in by_name:
            continue

        after_idx = by_name[after_name] + inserted
        before_idx = by_name[before_name] + inserted
        after_spec = out[after_idx]
        before_spec = out[before_idx]
        after_end = _span_end_ms(after_spec)
        before_start = float(before_spec.get("start_offset_ms", 0))
        gap = before_start - after_end
        if gap < float(rule.get("min_gap_ms", 80)):
            continue

        wait_dur = min(_resolve_wait_duration(rule, rng), max(20, gap - 8))
        wait_start = after_end + 4
        wait_spec = {
            "name": rule["wait_name"],
            "kind": "INTERNAL",
            "operation": "wait",
            "parent_index": 0,
            "start_offset_ms": wait_start,
            "duration_ms": wait_dur,
        }
        out.insert(before_idx, wait_spec)
        inserted += 1
        by_name = {spec["name"]: i for i, spec in enumerate(out)}

        shift_delta = (wait_start + wait_dur) - before_start + 4
        if shift_delta > 0:
            _shift_following_offsets(out, before_idx + 1, shift_delta)

    return out


def tighten_cs_routing_gap(specs: list[dict[str, Any]], system_id: str) -> None:
    """Ensure route.select starts after model.reasoning ends (CS only)."""
    if system_id != "sys-agt-cs-002":
        return
    by_name = {s["name"]: s for s in specs}
    model = by_name.get("model.reasoning")
    route = by_name.get("route.select")
    if not model or not route:
        return
    model_end = _span_end_ms(model)
    route_start = float(route.get("start_offset_ms", 0))
    if route_start < model_end + 8:
        delta = model_end + 12 - route_start
        names_after = ("route.select", "queue.assign", "business.outcome")
        for spec in specs:
            if spec["name"] in names_after:
                spec["start_offset_ms"] = float(spec.get("start_offset_ms", 0)) + delta


def prepare_healthy_specs(
    specs: list[dict[str, Any]],
    system: FleetSystem,
    rng,
) -> list[dict[str, Any]]:
    resolved = []
    for spec in specs:
        item = copy.deepcopy(spec)
        item["duration_ms"] = resolve_healthy_duration(item, system, rng)
        resolved.append(item)

    apply_healthy_outcome_to_specs(resolved, system.id, rng)
    for item in resolved:
        key = item.get("evaluation_key")
        if key:
            item["_healthy_evaluation"] = evaluation_for_key_healthy(key, system, rng)
    tighten_cs_routing_gap(resolved, system.id)
    return apply_wait_spans(resolved, system.id, rng)
