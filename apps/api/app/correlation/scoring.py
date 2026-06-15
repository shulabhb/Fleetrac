"""Deterministic Fleetrac prototype risk scoring."""

from __future__ import annotations

from typing import Any

SEVERITY_BANDS = {
    "medium": (6, 9),
    "high": (10, 13),
    "critical": (14, 99),
}


def clamp_score(value: int, low: int = 0, high: int = 3) -> int:
    return max(low, min(high, value))


def score_to_severity(score: int) -> str:
    if score >= SEVERITY_BANDS["critical"][0]:
        return "critical"
    if score >= SEVERITY_BANDS["high"][0]:
        return "high"
    if score >= SEVERITY_BANDS["medium"][0]:
        return "medium"
    return "medium"


def apply_minimum(severity: str, minimum: str) -> str:
    order = {"medium": 1, "high": 2, "critical": 3}
    if order.get(severity, 0) < order.get(minimum, 0):
        return minimum
    return severity


def apply_maximum(severity: str, maximum: str) -> str:
    order = {"medium": 1, "high": 2, "critical": 3}
    if order.get(severity, 0) > order.get(maximum, 0):
        return maximum
    return severity


def confidence_from_score(score: int, evidence_count: int) -> tuple[float, str]:
    base = 0.45 + min(0.4, evidence_count * 0.05) + min(0.15, score * 0.01)
    value = round(min(0.95, base), 2)
    if value >= 0.8:
        label = "high"
    elif value >= 0.6:
        label = "medium"
    else:
        label = "low"
    return value, label


def deviation_score(observed: float, threshold: float, *, scale: float = 1.0) -> int:
    if threshold <= 0:
        return 1
    ratio = observed / threshold
    if ratio >= 1.5:
        return 3
    if ratio >= 1.2:
        return 2
    if ratio >= 1.0:
        return 1
    return 0


def recurrence_score(occurrence_count: int, trace_count: int) -> int:
    if occurrence_count >= 4 or trace_count >= 4:
        return 3
    if occurrence_count >= 2 or trace_count >= 2:
        return 2
    if occurrence_count >= 1:
        return 1
    return 0


def bool_score(flag: bool, *, strong: bool = False) -> int:
    if not flag:
        return 0
    return 3 if strong else 2
