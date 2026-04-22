"""Changes & Impact generator.

For each governed Action that has progressed past approval, this module
synthesises a Change record with expected vs actual impact, before/after
metric deltas, and lifecycle state. The distribution of outcome states
(improvement, no material change, regression, rollback candidate, follow-up)
is deterministic but varied, so the Dashboard / System Detail / Action
Center surfaces read like a living fleet.
"""

from __future__ import annotations

import hashlib
import random
from datetime import datetime, timedelta, timezone

from app.sample_data.action_data import ACTION_STORE
from app.sample_data.mock_data import MOCK_STORE
from app.sample_data.operations_data import OPERATIONS_STORE
from app.schemas.operations import Change, ChangeLifecycleState, MetricDelta


def _rng(seed: str) -> random.Random:
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()
    return random.Random(int(digest[:8], 16))


_ACTION_TYPE_META: dict[str, dict] = {
    "prepare_threshold_change": {
        "change_type": "Threshold tuned",
        "summary": "Tuned control threshold based on Bob recommendation.",
        "watched": ["drift_index", "false_positive_rate"],
        "direction": "lower_is_better",
        "primary_label": "Drift index",
        "unit": None,
        "config_before": "drift threshold 0.26",
        "config_after": "drift threshold 0.23",
    },
    "prepare_control_split": {
        "change_type": "Control split prepared",
        "summary": "Split broad control into surface-specific controls for higher specificity.",
        "watched": ["false_positive_rate", "control_fire_rate"],
        "direction": "lower_is_better",
        "primary_label": "Control fire frequency",
        "unit": "/day",
    },
    "prepare_review_gate_tightening": {
        "change_type": "Review gate tightened",
        "summary": "Added reviewer gate on policy-sensitive surface.",
        "watched": ["policy_violation_rate", "reviewer_burden"],
        "direction": "lower_is_better",
        "primary_label": "Policy violation rate",
        "unit": None,
    },
    "prepare_routing_change": {
        "change_type": "Routing updated",
        "summary": "Shifted traffic toward healthier fallback path.",
        "watched": ["latency_p95_ms", "error_rate"],
        "direction": "lower_is_better",
        "primary_label": "p95 latency",
        "unit": "ms",
    },
    "prepare_config_suggestion": {
        "change_type": "Config change applied",
        "summary": "Applied Bob-prepared configuration change.",
        "watched": ["error_rate", "recurrence"],
        "direction": "lower_is_better",
        "primary_label": "Error rate",
        "unit": "%",
    },
    "request_rollback": {
        "change_type": "Rollback executed",
        "summary": "Rolled back to prior stable version.",
        "watched": ["error_rate", "incident_recurrence"],
        "direction": "lower_is_better",
        "primary_label": "Error rate",
        "unit": "%",
    },
    "request_emergency_review_path": {
        "change_type": "Emergency review path opened",
        "summary": "Opened emergency review path for on-call governance.",
        "watched": ["time_to_acknowledge"],
        "direction": "lower_is_better",
        "primary_label": "Time to acknowledge",
        "unit": "min",
    },
    "assign_owner": {
        "change_type": "Ownership re-routed",
        "summary": "Re-routed investigation to correct owner team.",
        "watched": ["time_to_resolution"],
        "direction": "lower_is_better",
        "primary_label": "Time to resolution",
        "unit": "h",
    },
    "open_ticket": {
        "change_type": "Governance ticket opened",
        "summary": "Opened governance ticket for owner-team action.",
        "watched": ["time_to_acknowledge"],
        "direction": "lower_is_better",
        "primary_label": "Time to acknowledge",
        "unit": "h",
    },
    "schedule_monitoring_window": {
        "change_type": "Monitoring window scheduled",
        "summary": "Scheduled monitoring window for the next telemetry cycle.",
        "watched": ["recurrence"],
        "direction": "lower_is_better",
        "primary_label": "Issue recurrence",
        "unit": "/week",
    },
    "enable_maintenance_mode": {
        "change_type": "Maintenance mode enabled",
        "summary": "Enabled maintenance mode and suppressed alert noise in-window.",
        "watched": ["alert_noise", "incident_recurrence"],
        "direction": "lower_is_better",
        "primary_label": "Alert noise",
        "unit": "/h",
    },
    "pause_workflow": {
        "change_type": "Workflow paused",
        "summary": "Paused risky workflow variant pending remediation.",
        "watched": ["policy_violation_rate"],
        "direction": "lower_is_better",
        "primary_label": "Policy violation rate",
        "unit": None,
    },
}


_OUTCOME_STATES: list[ChangeLifecycleState] = [
    "improvement_observed",
    "no_material_change",
    "regression_detected",
    "rollback_candidate",
    "follow_up_required",
    "closed",
]


def _environment_of(system):
    if system.environment in ("production", "staging"):
        return system.environment
    return "production"


def _metric_deltas(action, rng: random.Random, outcome: ChangeLifecycleState, meta: dict) -> list[MetricDelta]:
    before_primary = rng.uniform(0.6, 0.95)
    if outcome == "improvement_observed":
        after_primary = before_primary * rng.uniform(0.55, 0.8)
    elif outcome == "regression_detected":
        after_primary = before_primary * rng.uniform(1.08, 1.22)
    elif outcome == "rollback_candidate":
        after_primary = before_primary * rng.uniform(1.1, 1.3)
    elif outcome == "no_material_change":
        after_primary = before_primary * rng.uniform(0.96, 1.03)
    elif outcome == "follow_up_required":
        after_primary = before_primary * rng.uniform(0.9, 0.98)
    else:  # closed
        after_primary = before_primary * rng.uniform(0.6, 0.85)

    # Scale primary to a sensible-looking number per unit
    unit = meta.get("unit")
    if unit == "ms":
        before_primary *= 2000
        after_primary *= 2000
    elif unit == "%":
        before_primary *= 5
        after_primary *= 5
    elif unit == "/h":
        before_primary *= 12
        after_primary *= 12
    elif unit == "/day":
        before_primary *= 18
        after_primary *= 18
    elif unit == "/week":
        before_primary *= 4
        after_primary *= 4
    elif unit == "min":
        before_primary *= 18
        after_primary *= 18
    elif unit == "h":
        before_primary *= 9
        after_primary *= 9

    primary = MetricDelta(
        metric=meta["watched"][0],
        label=meta["primary_label"],
        before=round(before_primary, 3),
        after=round(after_primary, 3),
        unit=unit,
        direction=meta["direction"],
        baseline_window="Last 7 days pre-change",
        monitoring_window="Next 72h post-change",
    )
    deltas = [primary]
    # Optional secondary
    if len(meta["watched"]) > 1 and rng.random() < 0.8:
        sec_before = rng.uniform(0.4, 0.9)
        if outcome in ("improvement_observed", "closed"):
            sec_after = sec_before * rng.uniform(0.6, 0.85)
        elif outcome in ("regression_detected", "rollback_candidate"):
            sec_after = sec_before * rng.uniform(1.05, 1.2)
        else:
            sec_after = sec_before * rng.uniform(0.92, 1.05)
        secondary_label = meta["watched"][1].replace("_", " ").title()
        deltas.append(
            MetricDelta(
                metric=meta["watched"][1],
                label=secondary_label,
                before=round(sec_before, 3),
                after=round(sec_after, 3),
                unit=None,
                direction=meta["direction"],
                baseline_window="Last 7 days pre-change",
                monitoring_window="Next 72h post-change",
            )
        )
    return deltas


def _outcome_for(action, rng: random.Random) -> ChangeLifecycleState:
    """Pick a lifecycle state biased by current execution_status and risk."""

    exec_status = action.execution_status
    if exec_status == "executed":
        # Recently executed actions are in monitoring; most resolve to
        # improvement or no material change; a tail regresses or rolls back.
        roll = rng.random()
        if roll < 0.08:
            return "rollback_candidate"
        if roll < 0.18:
            return "regression_detected"
        if roll < 0.38:
            return "no_material_change"
        if roll < 0.52:
            return "follow_up_required"
        if roll < 0.85:
            return "improvement_observed"
        return "closed"
    if exec_status == "monitoring_outcome":
        roll = rng.random()
        if roll < 0.12:
            return "regression_detected"
        if roll < 0.28:
            return "no_material_change"
        if roll < 0.45:
            return "follow_up_required"
        if roll < 0.85:
            return "improvement_observed"
        return "monitoring"
    if exec_status == "follow_up_required":
        return "follow_up_required"
    if exec_status == "closed":
        return "closed"
    if exec_status == "reverted":
        return "rollback_candidate"
    if exec_status in ("approved", "ready_to_execute", "prepared"):
        return "approved"
    return "proposed"


def _summaries(outcome: ChangeLifecycleState, meta: dict, primary: MetricDelta) -> tuple[str, str]:
    expected = (
        f"Bob expected a {meta['direction'].replace('_', ' ')} shift in "
        f"{meta['primary_label'].lower()} after applying: {meta['summary']}"
    )
    if primary.before is None or primary.after is None:
        actual = "Awaiting first monitored telemetry window."
    else:
        pct = ((primary.after - primary.before) / primary.before) * 100 if primary.before else 0
        direction_word = "improved" if (
            (meta["direction"] == "lower_is_better" and pct < 0)
            or (meta["direction"] == "higher_is_better" and pct > 0)
        ) else "did not improve"
        if outcome == "regression_detected":
            actual = (
                f"Regression observed: {meta['primary_label']} moved {pct:+.1f}% "
                "on first monitoring window."
            )
        elif outcome == "rollback_candidate":
            actual = (
                f"{meta['primary_label']} regressed {pct:+.1f}%; "
                "Bob flagged this as a rollback candidate."
            )
        elif outcome == "no_material_change":
            actual = (
                f"{meta['primary_label']} changed {pct:+.1f}% — within noise band. "
                "No material improvement detected."
            )
        elif outcome == "follow_up_required":
            actual = (
                f"Partial improvement ({pct:+.1f}%). Follow-up scheduled to validate over next window."
            )
        elif outcome == "improvement_observed":
            actual = (
                f"Improvement confirmed: {meta['primary_label']} {direction_word} "
                f"{pct:+.1f}% on monitoring window."
            )
        elif outcome == "closed":
            actual = (
                f"Outcome held across two windows. {meta['primary_label']} {direction_word} "
                f"{pct:+.1f}% vs baseline."
            )
        else:  # monitoring / approved / proposed
            actual = "Monitoring window open — outcome pending."
    return expected, actual


def _build_change(action, systems_by_id, operations_store, now: datetime) -> Change | None:
    if action.execution_status in ("drafted", "awaiting_approval", "rejected"):
        return None
    system = systems_by_id.get(action.target_system_id) if action.target_system_id else None
    if system is None:
        return None
    ops = operations_store.get(system.id)
    meta = _ACTION_TYPE_META.get(action.action_type)
    if meta is None:
        # Fall back to a generic descriptor
        meta = {
            "change_type": action.action_type.replace("_", " ").title(),
            "summary": action.prepared_change_summary or "Governed change applied.",
            "watched": ["error_rate"],
            "direction": "lower_is_better",
            "primary_label": "Error rate",
            "unit": "%",
        }
    rng = _rng(f"change::{action.id}")
    outcome = _outcome_for(action, rng)

    deltas = _metric_deltas(action, rng, outcome, meta)
    expected, actual = _summaries(outcome, meta, deltas[0])

    executed_at = action.executed_at or (now - timedelta(hours=rng.randint(4, 120)))
    evaluated_at = executed_at + timedelta(hours=rng.randint(12, 72))
    if evaluated_at > now:
        evaluated_at = now - timedelta(minutes=rng.randint(5, 120))

    # Recurrence / reviewer-burden numbers
    recurrence_before = rng.randint(1, 6)
    if outcome == "improvement_observed":
        recurrence_after = max(0, recurrence_before - rng.randint(1, 3))
    elif outcome == "regression_detected":
        recurrence_after = recurrence_before + rng.randint(1, 2)
    elif outcome == "rollback_candidate":
        recurrence_after = recurrence_before + rng.randint(1, 3)
    else:
        recurrence_after = max(0, recurrence_before - rng.randint(0, 1))
    reviewer_before = rng.randint(3, 14)
    if outcome == "improvement_observed":
        reviewer_after = max(0, reviewer_before - rng.randint(2, 7))
    elif outcome in ("regression_detected", "rollback_candidate"):
        reviewer_after = reviewer_before + rng.randint(1, 3)
    else:
        reviewer_after = max(0, reviewer_before - rng.randint(0, 2))

    changed_by = "bob_with_approval" if action.execution_mode in (
        "bob_executes_after_approval",
        "bob_prepares",
    ) else "human"
    changed_by_label_map = {
        "bob_with_approval": f"Bob + {action.required_approver}",
        "bob": "Bob (Governance Copilot)",
        "human": action.required_approver or "Human operator",
        "external_team": action.recommended_owner,
    }

    rollback_recommended = outcome in ("rollback_candidate", "regression_detected")
    rollback_available = ops.rollback_available if ops else True

    return Change(
        id=f"chg_{action.id}",
        change_type=meta["change_type"],
        change_summary=meta["summary"],
        source_action_id=action.id,
        source_investigation_id=action.bob_investigation_id,
        source_incident_id=action.related_incident_id,
        target_system_id=system.id,
        target_system_name=action.target_system_name or system.name,
        environment=_environment_of(system),
        changed_by=changed_by,  # type: ignore[arg-type]
        changed_by_label=changed_by_label_map.get(changed_by, "Unknown"),
        version_before=ops.previous_version if ops else None,
        version_after=ops.current_version if ops else None,
        config_before=meta.get("config_before"),
        config_after=meta.get("config_after"),
        maintenance_state_before=None,
        maintenance_state_after=("maintenance" if ops and ops.maintenance.active else None),
        expected_impact_summary=expected,
        watched_metrics=meta["watched"],
        baseline_window="Last 7 days pre-change",
        monitoring_window="Next 72h post-change",
        actual_outcome_summary=actual,
        metric_deltas=deltas,
        recurrence_before=recurrence_before,
        recurrence_after=recurrence_after,
        reviewer_burden_before=reviewer_before,
        reviewer_burden_after=reviewer_after,
        impact_status=outcome,
        rollback_recommended=rollback_recommended,
        rollback_available=rollback_available,
        follow_up_required=outcome == "follow_up_required",
        executed_at=executed_at,
        evaluated_at=evaluated_at,
    )


def generate_changes_store() -> dict[str, list[Change]]:
    now = datetime.now(timezone.utc)
    systems_by_id = {s.id: s for s in MOCK_STORE["systems"]}
    changes: list[Change] = []
    for action in ACTION_STORE["actions"]:
        change = _build_change(action, systems_by_id, OPERATIONS_STORE, now)
        if change is not None:
            changes.append(change)
    changes.sort(key=lambda c: c.executed_at, reverse=True)
    return {"changes": changes}


CHANGES_STORE: dict[str, list[Change]] = generate_changes_store()
