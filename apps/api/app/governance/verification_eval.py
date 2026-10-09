"""Deterministic post-action verification from breach snapshots and recent telemetry."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.db.models import GovernedActionRow, Incident, NormalizedEvent


@dataclass(frozen=True)
class VerificationDecision:
    outcome: str
    summary: str
    baseline_value: float | None
    post_action_value: float | None
    threshold_value: float | None
    metric_name: str | None
    window_start: datetime | None
    window_end: datetime | None
    evidence_refs: list[str]
    recommended_follow_up: str
    computed_outcome: str
    used_story_fallback: bool


def _read_metric(metric: str | None, evaluation: dict | None) -> float | None:
    if not metric or not evaluation:
        return None
    if metric == "latency_ms":
        raw = evaluation.get("operation_latency_ms", evaluation.get("latency_ms"))
    elif metric in ("security_anomaly_count", "tool_scope_violation"):
        raw = evaluation.get(metric)
        if raw is None:
            raw = evaluation.get("tool_scope_violation", evaluation.get("security_anomaly_count"))
    else:
        raw = evaluation.get(metric)
    if raw is None:
        return None
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


def _clears(value: float, operator: str | None, threshold: float | None) -> bool:
    if threshold is None or operator is None:
        return False
    if operator == ">":
        return value <= threshold
    if operator == ">=":
        return value < threshold
    if operator == "<":
        return value >= threshold
    if operator == "<=":
        return value > threshold
    return False


def _moved(direction: str, baseline: float, post: float) -> str:
    """Return improved | worsened | flat."""
    if baseline == 0:
        delta = post - baseline
    else:
        delta = (post - baseline) / abs(baseline)
    if direction == "increase":
        if delta >= 0.1:
            return "improved"
        if delta <= -0.1:
            return "worsened"
        return "flat"
    if delta <= -0.1:
        return "improved"
    if delta >= 0.1:
        return "worsened"
    return "flat"


def _latest_metric(
    db: Session,
    *,
    system_id: str,
    metric: str | None,
    since: datetime | None,
) -> tuple[float | None, datetime | None, str | None]:
    q = db.query(NormalizedEvent).filter(NormalizedEvent.system_id == system_id)
    if since is not None:
        q = q.filter(NormalizedEvent.timestamp >= since)
    rows = q.order_by(NormalizedEvent.timestamp.desc()).limit(40).all()
    for row in rows:
        value = _read_metric(metric, row.evaluation_signals or {})
        if value is not None:
            return value, row.timestamp, row.event_id
    return None, None, None


def evaluate_verification(
    db: Session,
    *,
    action: GovernedActionRow,
    incident: Incident,
    requested_outcome: str | None = None,
) -> VerificationDecision:
    metric = action.expected_metric or incident.metric_name
    direction = action.expected_direction or "decrease"
    baseline = (
        incident.worst_observed_value
        if incident.worst_observed_value is not None
        else incident.latest_observed_value
    )
    threshold = incident.threshold_value
    operator = incident.threshold_operator
    window_start = action.updated_at or action.created_at
    post, post_ts, event_id = _latest_metric(
        db, system_id=action.system_id, metric=metric, since=window_start
    )

    used_story_fallback = False
    if post is not None and baseline is not None:
        movement = _moved(direction, float(baseline), post)
        cleared = _clears(post, operator, threshold)
        if movement == "worsened":
            computed = "rollback_candidate" if action.rollback_eligible else "regression_detected"
        elif cleared or movement == "improved":
            computed = "improvement_observed"
        else:
            computed = "no_material_change"
    else:
        computed = action.expected_result or "no_material_change"
        used_story_fallback = True

    final = (requested_outcome or "").strip() or computed
    refs = [event_id] if event_id else []
    if incident.trigger_event_id:
        refs.append(incident.trigger_event_id)

    if final == "improvement_observed":
        follow = "Keep monitoring the next window. No further governed change required."
    elif final in ("rollback_candidate", "regression_detected"):
        follow = "Review rollback eligibility and contain the change before the next release window."
    else:
        follow = "Schedule follow-up. The metric did not clear the threshold or move enough to close."

    base_txt = f"{baseline:.4g}" if baseline is not None else "n/a"
    post_txt = f"{post:.4g}" if post is not None else "n/a"
    thr_txt = f"{threshold:.4g}" if threshold is not None else "n/a"
    source = (
        "Story fallback — no post-action telemetry sample in the verification window."
        if used_story_fallback
        else "Computed from post-action telemetry."
    )
    summary = (
        f"{source} {metric or 'metric'} baseline {base_txt} → post-action {post_txt} "
        f"(threshold {operator or ''} {thr_txt}). "
        f"Computed {computed.replace('_', ' ')}; recorded {final.replace('_', ' ')}. "
        f"{follow}"
    )
    return VerificationDecision(
        outcome=final,
        summary=summary,
        baseline_value=float(baseline) if baseline is not None else None,
        post_action_value=post,
        threshold_value=float(threshold) if threshold is not None else None,
        metric_name=metric,
        window_start=window_start,
        window_end=post_ts or datetime.now(timezone.utc),
        evidence_refs=refs,
        recommended_follow_up=follow,
        computed_outcome=computed,
        used_story_fallback=used_story_fallback,
    )
