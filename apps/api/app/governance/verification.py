from __future__ import annotations

import asyncio
import uuid

from sqlalchemy.orm import Session

from app.db.models import GovernedActionRow, Incident, VerificationOutcomeRow
from app.governance.evidence import append_verification_evidence
from app.governance.incidents import advance_lifecycle
from app.simulator.http_ingest_client import post_ingest_sequence
from app.simulator.scenarios.healthy_baseline import healthy_baseline_batch


def verify_action(
    db: Session,
    *,
    action: GovernedActionRow,
    outcome: str,
    summary: str,
) -> VerificationOutcomeRow:
    row = VerificationOutcomeRow(
        id=str(uuid.uuid4()),
        action_id=action.id,
        incident_id=action.incident_id,
        outcome=outcome,
        summary=summary,
    )
    db.add(row)

    action.verification_status = outcome.replace("_", " ").title()
    if outcome == "improvement_observed":
        action.status = "Closed"
        inc = db.get(Incident, action.incident_id)
        if inc:
            advance_lifecycle(db, inc, "Closed", note=f"Verification: {outcome}")
    elif outcome in ("regression_detected", "rollback_candidate"):
        action.status = "Rollback candidate"
        inc = db.get(Incident, action.incident_id)
        if inc:
            advance_lifecycle(db, inc, "Verification", note=f"Verification: {outcome}")
    else:
        action.status = "Monitoring"

    append_verification_evidence(
        db,
        incident_id=action.incident_id,
        outcome=outcome,
        summary=summary,
    )

    if outcome == "improvement_observed":
        _emit_post_remediation_traffic(action.system_id)

    return row


def _emit_post_remediation_traffic(system_id: str) -> None:
    events = healthy_baseline_batch([system_id], count=3)
    try:
        asyncio.run(post_ingest_sequence(events))
    except RuntimeError:
        loop = asyncio.new_event_loop()
        try:
            loop.run_until_complete(post_ingest_sequence(events))
        finally:
            loop.close()
