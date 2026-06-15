from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.db.models import Assignment, Incident, Notification
from app.fleet.registry import SYSTEM_BY_ID


def record_notification_and_assignment(
    db: Session,
    *,
    incident_id: str,
    title: str,
    owner_team: str,
) -> None:
    incident = db.get(Incident, incident_id)
    system_id = incident.system_id if incident else None
    system = SYSTEM_BY_ID.get(system_id) if system_id else None
    team_lead = system.team_lead if system else "Anika Rao"
    reviewer = system.default_reviewer if system else "Evan Brooks"

    db.add(
        Notification(
            id=str(uuid.uuid4()),
            incident_id=incident_id,
            channel="in_app",
            recipient=team_lead,
            status="sent",
            message=f"Governance alert: {title} requires attention.",
        )
    )
    db.add(
        Notification(
            id=str(uuid.uuid4()),
            incident_id=incident_id,
            channel="slack",
            recipient=f"#{owner_team.lower().replace(' ', '-')}",
            status="sent",
            message=f"[Fleetrac] {title} — assigned reviewer {reviewer}.",
        )
    )
    db.add(
        Notification(
            id=str(uuid.uuid4()),
            incident_id=incident_id,
            channel="email",
            recipient=team_lead,
            status="sent",
            message=f"Fleetrac packaged evidence for incident {incident_id}.",
        )
    )
    db.add(
        Assignment(
            id=str(uuid.uuid4()),
            incident_id=incident_id,
            reviewer_name=reviewer,
            role="reviewer",
        )
    )
