"""Phase G — breach snapshot helpers for runtime risk create/update + evidence copy."""

from __future__ import annotations

from datetime import datetime, timezone

from app.db.models import Incident
from app.detection.engine import DetectionMatch
from app.fleet.registry import RULE_BY_ID, RULE_SPECS, SYSTEM_BY_ID

RULE_BY_SIGNAL = {r.signal_type: r for r in RULE_SPECS}


CONTROL_LABELS: dict[str, str] = {
    "rule_unsupported_claim_high": "Unsupported claim rate elevated",
    "rule_grounding_low": "Grounding below threshold",
    "rule_tool_scope_violation": "Security / tool-scope anomaly",
    "rule_retrieval_failure": "Retrieval failure rate high",
    "rule_latency_high": "Latency too high",
    "rule_sensitive_output": "Sensitive output exposure",
    "rule_unapproved_region": "Unapproved region usage",
}

METRIC_LABELS: dict[str, str] = {
    "unsupported_claim_rate": "unsupported claim rate",
    "grounding_score": "grounding score",
    "tool_scope_violation": "tool scope violation count",
    "retrieval_failure_rate": "retrieval failure rate",
    "latency_ms": "operation latency (ms)",
    "sensitive_output": "sensitive output flag",
    "unapproved_region": "unapproved region flag",
}


def control_name_for(rule_id: str | None, signal_type: str | None = None) -> str:
    if rule_id and rule_id in CONTROL_LABELS:
        return CONTROL_LABELS[rule_id]
    if signal_type:
        return signal_type.replace("_", " ").title()
    return "Governance control"


def metric_name_for(match: DetectionMatch | None, rule_id: str | None = None) -> str | None:
    if match:
        spec = RULE_BY_ID.get(match.rule_id)
        if spec:
            return spec.threshold_field
    if rule_id:
        spec = RULE_BY_ID.get(rule_id)
        if spec:
            return spec.threshold_field
    return None


def threshold_operator_for(rule_id: str | None) -> str | None:
    if not rule_id:
        return None
    spec = RULE_BY_ID.get(rule_id)
    return spec.threshold_operator if spec else None


def _is_worse(operator: str | None, new_val: float, old_val: float) -> bool:
    """Higher is worse for >/>= thresholds; lower is worse for </<= (e.g. grounding)."""
    if operator in ("<", "<="):
        return new_val < old_val
    return new_val > old_val


def _observed_from_evaluation(metric: str | None, evaluation: dict | None) -> float | None:
    if not metric or not evaluation:
        return None
    if metric == "latency_ms":
        raw = evaluation.get("operation_latency_ms", evaluation.get("latency_ms"))
        return float(raw) if raw is not None else None
    if metric not in evaluation:
        return None
    try:
        return float(evaluation[metric])
    except (TypeError, ValueError):
        return None


def apply_breach_snapshot(
    incident: Incident,
    *,
    match: DetectionMatch | None,
    recommended_action: str | None,
    trigger_event_id: str | None,
    observed_at: datetime | None = None,
    signal_type: str | None = None,
    evaluation: dict | None = None,
) -> None:
    """Update breach metric fields on create or recurrence. Preserves first_seen (opened_at)."""
    now = observed_at or datetime.now(timezone.utc)
    incident.last_seen_at = now

    rule_id: str | None = None
    metric: str | None = None
    operator: str | None = None
    threshold: float | None = None
    observed: float | None = None
    control_signal = signal_type or incident.signal_type

    if match is not None:
        rule_id = match.rule_id
        metric = metric_name_for(match)
        operator = threshold_operator_for(match.rule_id)
        threshold = match.threshold_value
        observed = match.metric_value
        control_signal = match.signal_type
    else:
        spec = RULE_BY_SIGNAL.get(control_signal or "")
        if spec:
            rule_id = spec.id
            metric = spec.threshold_field
            operator = spec.threshold_operator
            threshold = spec.threshold_value
            observed = _observed_from_evaluation(metric, evaluation)

    if rule_id and (incident.rule_id in (None, "", "correlation_policy") or match is not None):
        incident.rule_id = rule_id
    if metric:
        incident.metric_name = metric
    if threshold is not None:
        incident.threshold_value = threshold
    if operator:
        incident.threshold_operator = operator
    if control_signal:
        incident.control_name = control_name_for(rule_id or incident.rule_id, control_signal)
    if observed is not None:
        incident.latest_observed_value = observed
        if incident.worst_observed_value is None:
            incident.worst_observed_value = observed
        elif _is_worse(operator or incident.threshold_operator, observed, float(incident.worst_observed_value)):
            incident.worst_observed_value = observed

    if recommended_action:
        incident.recommended_next_step = recommended_action
    elif not incident.recommended_next_step:
        incident.recommended_next_step = (
            "Review Risk Detail, then send a bounded governed action to Action Center."
        )

    if trigger_event_id:
        incident.trigger_event_id = trigger_event_id


def backfill_breach_snapshot_if_needed(incident: Incident, evaluation: dict | None = None) -> bool:
    """Fill missing Phase G fields on legacy rows (e.g. pitch idempotent re-runs)."""
    if incident.metric_name and incident.latest_observed_value is not None and incident.control_name:
        return False
    apply_breach_snapshot(
        incident,
        match=None,
        recommended_action=incident.recommended_next_step,
        trigger_event_id=incident.trigger_event_id,
        observed_at=incident.last_seen_at,
        signal_type=incident.signal_type,
        evaluation=evaluation,
    )
    return True


def evidence_explanation(
    *,
    system_id: str,
    match: DetectionMatch | None,
    occurrence_count: int,
    window_minutes: int = 15,
    signal_type: str | None = None,
    trace_id: str | None = None,
    span_name: str | None = None,
    operation_type: str | None = None,
) -> str:
    """UI-ready explanation for evidence snapshot (keeps span/trace anchors for audit)."""
    system = SYSTEM_BY_ID.get(system_id)
    system_label = system.name_alias if system else system_id
    control = control_name_for(match.rule_id if match else None, signal_type)
    span_hint = span_name or operation_type
    if match is None:
        base = (
            f"{control} correlated for {system_label}. "
            f"{occurrence_count} related event(s) in the last {window_minutes} minutes."
        )
        if span_hint:
            base += f" Source span {span_hint}."
        if trace_id:
            base += f" Example trace={trace_id}."
        return base

    metric = metric_name_for(match) or "metric"
    metric_label = METRIC_LABELS.get(metric, metric.replace("_", " "))
    op = threshold_operator_for(match.rule_id) or ">"
    observed = match.metric_value
    threshold = match.threshold_value

    if op in ("<", "<="):
        relation = f"dropped to {observed:.4g} against a {threshold:.4g} minimum"
    else:
        relation = f"rose to {observed:.4g} against a {threshold:.4g} threshold"

    text = (
        f"{control}: {metric_label} {relation} for {system_label}. "
        f"{occurrence_count} related event(s) in the last {window_minutes} minutes "
        f"support this governance breach."
    )
    if span_hint:
        text += f" Source span {span_hint}."
    if trace_id:
        text += f" Example trace={trace_id}."
    return text
