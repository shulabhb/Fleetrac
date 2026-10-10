"""One current in-app notification per risk.

Legacy Slack and email rows stay in the table and are omitted from the bell.
A new row is written only when the next step changes.
"""

from __future__ import annotations

import uuid
from datetime import timezone

from sqlalchemy.orm import Session

from app.db.models import Assignment, GovernedActionRow, Incident, Notification
from app.fleet.registry import SYSTEM_BY_ID

_SUPERSEDED = "superseded"


def record_notification_and_assignment(
    db: Session,
    *,
    incident_id: str,
    title: str,
    owner_team: str,
) -> None:
    """Create the reviewer assignment and the first in-app notice. No Slack or email."""
    del title  # The current step, not the incident title, is the notice.
    incident = db.get(Incident, incident_id)
    if incident is None:
        return

    system = SYSTEM_BY_ID.get(incident.system_id) if incident.system_id else None
    reviewer = system.default_reviewer if system else "Evan Brooks"
    existing = (
        db.query(Assignment)
        .filter(Assignment.incident_id == incident_id, Assignment.role == "reviewer")
        .first()
    )
    if existing is None:
        db.add(
            Assignment(
                id=str(uuid.uuid4()),
                incident_id=incident_id,
                reviewer_name=reviewer,
                role="reviewer",
            )
        )
    sync_current_notification(db, incident, trigger="derive")
    del owner_team


def notify_severity_escalation(
    db: Session,
    incident: Incident,
    *,
    previous: str | None,
    new: str | None,
) -> Notification | None:
    """One notice when severity rises to critical. Repeating critical does not add a row."""
    if (new or "").lower() != "critical":
        return None
    if (previous or "").lower() == "critical":
        return None
    if not previous:
        return None
    return sync_current_notification(db, incident, trigger="severity")


def notify_regression(db: Session, incident: Incident) -> Notification | None:
    """One notice when a closed risk is breached again or verification records regression."""
    return sync_current_notification(db, incident, trigger="regression")


def sync_current_notification(
    db: Session,
    incident: Incident,
    *,
    trigger: str,
) -> Notification | None:
    """Upsert the visible in-app row. Same kind refreshes copy. A new kind replaces it."""
    action = _primary_action(db, incident.id)
    kind, message, target, action_id = _compose(incident, action, trigger)
    current = _current_row(db, incident.id)
    if current is not None and current.kind == kind:
        current.message = message
        current.target = target
        current.action_id = action_id
        db.flush()
        return current

    if current is not None:
        current.status = _SUPERSEDED

    system = SYSTEM_BY_ID.get(incident.system_id) if incident.system_id else None
    recipient = system.team_lead if system else incident.owner_team
    row = Notification(
        id=str(uuid.uuid4()),
        incident_id=incident.id,
        channel="in_app",
        recipient=recipient,
        status="sent",
        message=message,
        kind=kind,
        target=target,
        action_id=action_id,
    )
    db.add(row)
    db.flush()
    return row


def backfill_current_notifications(db: Session) -> int:
    """Give each risk one current in-app row when older channel copies are all it has."""
    written = 0
    for incident in db.query(Incident).all():
        if _current_row(db, incident.id) is None:
            sync_current_notification(db, incident, trigger="derive")
            written += 1
    return written


def list_current_notifications(db: Session, *, limit: int = 50) -> list[dict]:
    backfill_current_notifications(db)
    rows = (
        db.query(Notification)
        .filter(
            Notification.channel == "in_app",
            Notification.kind.isnot(None),
            Notification.status != _SUPERSEDED,
        )
        .order_by(Notification.created_at.desc())
        .all()
    )
    seen: set[str] = set()
    items: list[dict] = []
    for note in rows:
        if note.incident_id in seen:
            continue
        seen.add(note.incident_id)
        incident = db.get(Incident, note.incident_id)
        items.append(
            {
                "id": note.id,
                "incident_id": note.incident_id,
                "alias_id": incident.alias_id if incident else None,
                "owner_team": incident.owner_team if incident else None,
                "channel": note.channel,
                "recipient": note.recipient,
                "status": note.status,
                "message": note.message,
                "kind": note.kind,
                "target": note.target,
                "action_id": note.action_id,
                "created_at": _iso(note.created_at),
            }
        )
        if len(items) >= limit:
            break
    return items


def _iso(value) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def _current_row(db: Session, incident_id: str) -> Notification | None:
    return (
        db.query(Notification)
        .filter(
            Notification.incident_id == incident_id,
            Notification.channel == "in_app",
            Notification.kind.isnot(None),
            Notification.status != _SUPERSEDED,
        )
        .order_by(Notification.created_at.desc())
        .first()
    )


def _primary_action(db: Session, incident_id: str) -> GovernedActionRow | None:
    from app.governance.actions import select_primary_action

    rows = (
        db.query(GovernedActionRow)
        .filter(GovernedActionRow.incident_id == incident_id)
        .all()
    )
    return select_primary_action(rows)


def _compose(
    incident: Incident,
    action: GovernedActionRow | None,
    trigger: str,
) -> tuple[str, str, str, str | None]:
    alias = incident.alias_id or incident.id
    if trigger == "severity":
        return (
            "severity",
            f"{alias} severity raised to critical. Review risk.",
            "incident-queue",
            None,
        )
    if trigger == "regression":
        return (
            "regression",
            f"{alias} regressed after verification. Review risk.",
            "incident-queue",
            None,
        )
    return _derived(alias, action)


def _derived(
    alias: str,
    action: GovernedActionRow | None,
) -> tuple[str, str, str, str | None]:
    if action is None:
        return (
            "decision",
            f"{alias} needs a decision. Review governed action.",
            "action-center",
            None,
        )
    verification = (action.verification_status or "").lower().replace("_", " ")
    status = (action.status or "").lower()
    if "regression" in verification:
        return (
            "regression",
            f"{alias} regressed after verification. Review risk.",
            "incident-queue",
            None,
        )
    if "rollback" in verification or "rollback" in status:
        return (
            "rollback",
            f"{alias} is a rollback candidate. Review rollback path.",
            "action-center",
            action.id,
        )
    if "no material" in verification or "follow" in verification:
        return (
            "follow_up",
            f"{alias} shows no material change. Review follow-up.",
            "action-center",
            action.id,
        )
    if "improvement" in verification:
        return (
            "improvement",
            f"{alias} improved. View outcome evidence.",
            "evidence",
            None,
        )
    if "reject" in status:
        return (
            "rejected",
            f"{alias} was rejected. View the evidence record.",
            "evidence",
            None,
        )
    if status in ("approved", "monitoring") or verification == "monitoring":
        return (
            "verify",
            f"{alias} is approved. Verify impact.",
            "action-center",
            action.id,
        )
    return (
        "decision",
        f"{alias} needs a decision. Review governed action.",
        "action-center",
        action.id,
    )
