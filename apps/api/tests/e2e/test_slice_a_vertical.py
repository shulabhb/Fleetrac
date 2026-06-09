from __future__ import annotations

import pytest
from httpx import ASGITransport

from app.api.routes.simulator import run_scenario_with_transport
from app.db.models import Assignment, Incident, NormalizedEvent, Notification, RawEvent
from app.db.session import get_session_factory
from app.slice_a.constants import (
    INCIDENT_ALIAS_ID,
    INCIDENT_CANONICAL_ID,
    LIFECYCLE_FINAL,
    OWNER_TEAM,
)


@pytest.mark.asyncio
async def test_slice_a_vertical(client, app):
    assert client.post("/api/v1/simulator/reset").status_code == 200

    transport = ASGITransport(app=app)
    factory = get_session_factory()
    db = factory()
    try:
        result = await run_scenario_with_transport(transport, db=db)
    finally:
        db.close()

    assert result.failed is None
    assert result.posted == 6

    db = factory()
    try:
        assert db.query(RawEvent).count() == 6
        assert db.query(NormalizedEvent).count() == 6

        inc = db.query(Incident).filter(Incident.id == INCIDENT_CANONICAL_ID).one()
        assert inc.alias_id == INCIDENT_ALIAS_ID
        assert inc.lifecycle == LIFECYCLE_FINAL
        stages = [h.get("to") for h in inc.lifecycle_history]
        assert "Packaged" in stages
        assert LIFECYCLE_FINAL in stages

        assert db.query(Notification).filter(Notification.incident_id == inc.id).count() >= 1
        assert db.query(Assignment).filter(Assignment.incident_id == inc.id).count() >= 1
    finally:
        db.close()

    signals = client.get("/api/v1/governance/live-signals", params={"system_id": inc.system_id})
    assert signals.status_code == 200
    payload = signals.json()
    assert payload["total"] >= 1
    assert any(row.get("incident_id") == INCIDENT_CANONICAL_ID for row in payload["items"])

    queue = client.get(
        "/api/v1/governance/owner-queue",
        params={"owner_team": OWNER_TEAM},
    )
    assert queue.status_code == 200
    qitems = queue.json()["items"]
    assert any(row["alias_id"] == INCIDENT_ALIAS_ID for row in qitems)

    evidence = client.get(f"/api/v1/governance/evidence/{INCIDENT_ALIAS_ID}")
    assert evidence.status_code == 200
    ev = evidence.json()
    assert ev["incident_id"] == INCIDENT_CANONICAL_ID
    assert ev["fleetrac_analysis"]["alias_id"] == INCIDENT_ALIAS_ID
    assert len(ev["items"]) >= 1
