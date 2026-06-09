from __future__ import annotations

from datetime import datetime, timezone

from app.db.models import Incident
from app.db.session import get_session_factory, init_db, reset_engine
from app.detection.correlator import find_active_incident
from app.slice_a.constants import INCIDENT_ALIAS_ID, INCIDENT_CANONICAL_ID, OWNER_TEAM


def test_correlator_reuses_incident_within_window(database_url: str):
    reset_engine(database_url)
    init_db()
    factory = get_session_factory()
    db = factory()
    now = datetime.now(timezone.utc)
    db.add(
        Incident(
            id=INCIDENT_CANONICAL_ID,
            alias_id=INCIDENT_ALIAS_ID,
            system_id="sys-agt-treasury-001",
            correlation_key="sys-agt-treasury-001:unsupported_claim_elevated",
            rule_id="rule_unsupported_claim_high",
            signal_type="unsupported_claim_elevated",
            classification_category="Output Reliability",
            severity="Critical",
            priority="P1",
            lifecycle="Owner Review",
            owner_team=OWNER_TEAM,
            title="t",
            summary="s",
            lifecycle_history=[],
            opened_at=now,
        )
    )
    db.commit()

    found = find_active_incident(
        db,
        correlation_key="sys-agt-treasury-001:unsupported_claim_elevated",
        as_of=now,
    )
    assert found is not None
    assert found.id == INCIDENT_CANONICAL_ID
    db.close()
