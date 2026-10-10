from __future__ import annotations

import asyncio
import uuid

from sqlalchemy.orm import Session

from app.db.models import GovernedActionRow, Incident, VerificationOutcomeRow
from app.governance.evidence import append_verification_evidence
from app.governance.incidents import advance_lifecycle
from app.governance.verification_eval import evaluate_verification
from app.simulator.http_ingest_client import post_ingest_sequence
from app.simulator.scenarios.healthy_baseline import healthy_baseline_batch


def verify_action(
    db: Session,
    *,
    action: GovernedActionRow,
    outcome: str | None = None,
    summary: str = "",
) -> VerificationOutcomeRow:
    incident = db.get(Incident, action.incident_id)
    if incident is None:
        raise ValueError(f"Incident {action.incident_id} not found for action {action.id}")

    decision = evaluate_verification(
        db,
        action=action,
        incident=incident,
        requested_outcome=outcome or None,
    )
    recorded_summary = summary.strip() or decision.summary
    if summary.strip() and decision.summary not in recorded_summary:
        recorded_summary = f"{summary.strip()} {decision.summary}"

    latest = (
        db.query(VerificationOutcomeRow)
        .filter(VerificationOutcomeRow.action_id == action.id)
        .order_by(VerificationOutcomeRow.created_at.desc())
        .first()
    )
    same_outcome = latest is not None and latest.outcome == decision.outcome
    if same_outcome and latest is not None:
        latest.summary = recorded_summary
        latest.post_action_value = decision.post_action_value
        latest.baseline_value = decision.baseline_value
        latest.threshold_value = decision.threshold_value
        latest.metric_name = decision.metric_name
        latest.verification_window_end = decision.window_end
        latest.evidence_refs = decision.evidence_refs
        latest.recommended_follow_up = decision.recommended_follow_up
        row = latest
        db.flush()
    else:
        row = VerificationOutcomeRow(
            id=str(uuid.uuid4()),
            action_id=action.id,
            incident_id=action.incident_id,
            outcome=decision.outcome,
            summary=recorded_summary,
            system_id=action.system_id,
            baseline_value=decision.baseline_value,
            post_action_value=decision.post_action_value,
            threshold_value=decision.threshold_value,
            metric_name=decision.metric_name,
            verification_window_start=decision.window_start,
            verification_window_end=decision.window_end,
            evidence_refs=decision.evidence_refs,
            recommended_follow_up=decision.recommended_follow_up,
        )
        db.add(row)
        append_verification_evidence(
            db,
            incident_id=action.incident_id,
            outcome=decision.outcome,
            summary=recorded_summary,
            close_record=(
                decision.outcome == "improvement_observed"
                and decision.computed_outcome == "improvement_observed"
                and not decision.used_story_fallback
            ),
        )
        db.flush()

    action.verification_status = decision.outcome.replace("_", " ").title()
    # Auto-close only when telemetry itself shows improvement. An operator label
    # without a measured clear stays close-ready.
    real_improvement = (
        decision.outcome == "improvement_observed"
        and decision.computed_outcome == "improvement_observed"
        and not decision.used_story_fallback
    )
    if real_improvement:
        action.status = "Closed"
        if incident.lifecycle != "Closed":
            advance_lifecycle(db, incident, "Closed", note=f"Verification: {decision.outcome}")
    elif decision.outcome == "improvement_observed":
        if action.status in {"Closed", "Rejected", "Policy-blocked"}:
            action.status = "Monitoring"
        elif action.status not in {"Approved", "Monitoring", "Executed"}:
            action.status = "Monitoring"
        if incident.lifecycle == "Closed":
            advance_lifecycle(db, incident, "Verification", note="Improvement recorded without a measured clear")
        elif incident.lifecycle != "Verification":
            advance_lifecycle(db, incident, "Verification", note=f"Verification: {decision.outcome}")
    elif decision.outcome == "regression_detected":
        action.status = "Monitoring"
        if incident.lifecycle != "Verification":
            advance_lifecycle(db, incident, "Verification", note=f"Verification: {decision.outcome}")
    elif decision.outcome == "rollback_candidate":
        action.status = "Rollback candidate"
        if incident.lifecycle != "Verification":
            advance_lifecycle(db, incident, "Verification", note=f"Verification: {decision.outcome}")
    else:
        action.status = "Monitoring"
        if incident.lifecycle != "Verification":
            advance_lifecycle(db, incident, "Verification", note=f"Verification: {decision.outcome}")

    from app.governance.notifications import notify_regression, sync_current_notification

    if decision.outcome == "regression_detected":
        notify_regression(db, incident)
    else:
        sync_current_notification(db, incident, trigger="derive")

    if decision.outcome == "improvement_observed":
        _emit_post_remediation_traffic(action.system_id)

    return row


def _emit_post_remediation_traffic(system_id: str) -> None:
    events = healthy_baseline_batch([system_id], count=3)
    try:
        asyncio.run(post_ingest_sequence(events))
    except Exception:
        return
