from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.db.models import GovernedActionRow, Incident
from app.fleet.registry import SYSTEM_BY_ID, incident_alias
from app.governance.incidents import advance_lifecycle


def create_action_from_incident(
    db: Session,
    incident: Incident,
    *,
    execution_mode: str = "approval_required",
) -> GovernedActionRow:
    system = SYSTEM_BY_ID.get(incident.system_id)
    system_name = system.name_alias if system else incident.system_id
    action_id = f"act_{incident.alias_id}_{uuid.uuid4().hex[:8]}"
    row = GovernedActionRow(
        id=action_id,
        incident_id=incident.id,
        alias_id=incident.alias_id,
        title=f"Remediate — {incident.title}",
        owner_team=incident.owner_team,
        system_id=incident.system_id,
        system_name=system_name,
        risk_category=incident.classification_category,
        severity=incident.severity,
        execution_mode=execution_mode,
        status="Awaiting approval",
        verification_status="Not started",
        recommended_action=incident.summary[:512],
    )
    db.add(row)
    return row


def list_actions(db: Session, *, status: str | None = None) -> list[GovernedActionRow]:
    q = db.query(GovernedActionRow).order_by(GovernedActionRow.created_at.desc())
    if status:
        q = q.filter(GovernedActionRow.status == status)
    return q.all()


def get_action(db: Session, action_id: str) -> GovernedActionRow | None:
    return db.get(GovernedActionRow, action_id)


def approve_action(db: Session, action: GovernedActionRow) -> GovernedActionRow:
    action.status = "Approved"
    action.verification_status = "Monitoring"
    inc = db.get(Incident, action.incident_id)
    if inc:
        advance_lifecycle(db, inc, "Remediation", note="Governed action approved")
    return action


def reject_action(db: Session, action: GovernedActionRow) -> GovernedActionRow:
    action.status = "Rejected"
    action.verification_status = "Not started"
    return action
