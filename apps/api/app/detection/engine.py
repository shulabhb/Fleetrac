from __future__ import annotations

from dataclasses import dataclass

from app.db.models import DetectionRule
from app.fleet.registry import RULE_BY_ID
from app.schemas.fleetrac_event import FleetracEvent


@dataclass
class DetectionMatch:
    rule_id: str
    signal_type: str
    severity: str
    risk_category: str
    priority: str
    lifecycle_final: str
    metric_value: float
    threshold_value: float


def _compare(operator: str, value: float, threshold: float) -> bool:
    if operator == ">":
        return value > threshold
    if operator == ">=":
        return value >= threshold
    if operator == "<":
        return value < threshold
    if operator == "<=":
        return value <= threshold
    return False


def _metric_value(event: FleetracEvent, field: str) -> float | None:
    if field == "latency_ms":
        raw = event.evaluation_signals.get("operation_latency_ms")
        if raw is None and event.operation_type in ("model_call", "tool_call"):
            raw = event.evaluation_signals.get("latency_ms")
        if raw is None:
            return None
        return float(raw)
    if field not in event.evaluation_signals:
        return None
    return float(event.evaluation_signals.get(field, 0.0))


def evaluate_event(event: FleetracEvent, rules: list[DetectionRule]) -> DetectionMatch | None:
    for rule in rules:
        if not rule.enabled:
            continue
        spec = RULE_BY_ID.get(rule.id)
        if spec is None:
            continue

        # Policy-deny tool scope
        if rule.id not in (
            "rule_tool_scope_violation",
            "rule_sensitive_output",
            "rule_unapproved_region",
        ):
            value = _metric_value(event, rule.threshold_field)
            if value is None:
                continue
            if _compare(rule.threshold_operator, value, rule.threshold_value):
                return DetectionMatch(
                    rule_id=rule.id,
                    signal_type=spec.signal_type,
                    severity=spec.severity,
                    risk_category=spec.risk_category,
                    priority=spec.priority,
                    lifecycle_final=spec.lifecycle_final,
                    metric_value=value,
                    threshold_value=rule.threshold_value,
                )
            continue

        if rule.id == "rule_tool_scope_violation":
            if float(event.evaluation_signals.get("tool_scope_violation", 0)) >= 1.0:
                return DetectionMatch(
                    rule_id=rule.id,
                    signal_type=spec.signal_type,
                    severity=spec.severity,
                    risk_category=spec.risk_category,
                    priority=spec.priority,
                    lifecycle_final=spec.lifecycle_final,
                    metric_value=1.0,
                    threshold_value=1.0,
                )
            if event.policy_result == "deny" and event.operation_type == "tool_call":
                return DetectionMatch(
                    rule_id=rule.id,
                    signal_type=spec.signal_type,
                    severity=spec.severity,
                    risk_category=spec.risk_category,
                    priority=spec.priority,
                    lifecycle_final=spec.lifecycle_final,
                    metric_value=1.0,
                    threshold_value=1.0,
                )
            continue

        if rule.id == "rule_sensitive_output":
            if event.evaluation_signals.get("sensitive_output"):
                return DetectionMatch(
                    rule_id=rule.id,
                    signal_type=spec.signal_type,
                    severity=spec.severity,
                    risk_category=spec.risk_category,
                    priority=spec.priority,
                    lifecycle_final=spec.lifecycle_final,
                    metric_value=1.0,
                    threshold_value=1.0,
                )
            continue

        if rule.id == "rule_unapproved_region":
            if event.evaluation_signals.get("unapproved_region"):
                return DetectionMatch(
                    rule_id=rule.id,
                    signal_type=spec.signal_type,
                    severity=spec.severity,
                    risk_category=spec.risk_category,
                    priority=spec.priority,
                    lifecycle_final=spec.lifecycle_final,
                    metric_value=1.0,
                    threshold_value=1.0,
                )
            continue

    return None
