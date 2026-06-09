from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.db.models import Incident
from app.slice_a.constants import CORRELATION_WINDOW_MINUTES


def find_active_incident(
    db: Session,
    *,
    correlation_key: str,
    as_of: datetime,
) -> Incident | None:
    window_start = as_of - timedelta(minutes=CORRELATION_WINDOW_MINUTES)
    if as_of.tzinfo is None:
        as_of = as_of.replace(tzinfo=timezone.utc)
        window_start = window_start.replace(tzinfo=timezone.utc)

    q = (
        db.query(Incident)
        .filter(Incident.correlation_key == correlation_key)
        .order_by(Incident.updated_at.desc())
    )
    for inc in q.all():
        opened = inc.opened_at
        if opened.tzinfo is None:
            opened = opened.replace(tzinfo=timezone.utc)
        if opened >= window_start:
            return inc
    return None
