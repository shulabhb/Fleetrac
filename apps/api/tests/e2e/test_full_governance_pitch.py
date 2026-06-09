from __future__ import annotations

import pytest
from httpx import ASGITransport

from app.api.routes.simulator import run_scenario_with_transport
from app.db.models import GovernedActionRow, Incident, VerificationOutcomeRow
from app.db.session import get_session_factory
from app.slice_a.constants import INCIDENT_ALIAS_ID, INCIDENT_CANONICAL_ID, OWNER_TEAM


@pytest.mark.asyncio
async def test_full_governance_pitch(client, app):
    """Reset → scenario → action handoff → approve → verify (Phase 8/9 E2E)."""
    assert client.post("/api/v1/simulator/reset").status_code == 200

    transport = ASGITransport(app=app)
    factory = get_session_factory()
    db = factory()
    try:
        result = await run_scenario_with_transport(transport, db=db)
    finally:
        db.close()

    assert result.failed is None
    assert result.posted >= 1

    create = client.post(
        f"/api/v1/governance/incidents/{INCIDENT_ALIAS_ID}/actions",
        json={"execution_mode": "approval_required"},
    )
    assert create.status_code == 200
    action_id = create.json()["action_id"]

    approve = client.post(f"/api/v1/governance/actions/{action_id}/approve")
    assert approve.status_code == 200
    assert approve.json()["status"] == "Approved"

    verify = client.post(
        f"/api/v1/governance/actions/{action_id}/verify",
        json={
            "outcome": "improvement_observed",
            "summary": "Unsupported claim rate returned below threshold.",
        },
    )
    assert verify.status_code == 200
    assert verify.json()["outcome"] == "improvement_observed"

    dash = client.get("/api/v1/governance/dashboard-summary")
    assert dash.status_code == 200
    summary = dash.json()
    assert summary["verification_improved"] >= 1
    assert summary["active_incidents"] >= 0

    actions = client.get("/api/v1/governance/actions")
    assert actions.status_code == 200
    assert any(row["id"] == action_id for row in actions.json()["items"])

    notifs = client.get("/api/v1/governance/notifications")
    assert notifs.status_code == 200

    factory = get_session_factory()
    db = factory()
    try:
        inc = db.get(Incident, INCIDENT_CANONICAL_ID)
        assert inc is not None
        action = db.get(GovernedActionRow, action_id)
        assert action is not None
        assert action.status == "Closed"
        outcomes = (
            db.query(VerificationOutcomeRow)
            .filter(VerificationOutcomeRow.action_id == action_id)
            .count()
        )
        assert outcomes >= 1
    finally:
        db.close()

    queue = client.get(
        "/api/v1/governance/owner-queue",
        params={"owner_team": OWNER_TEAM},
    )
    assert queue.status_code == 200

    evidence = client.get(f"/api/v1/governance/evidence/{INCIDENT_ALIAS_ID}")
    assert evidence.status_code == 200

    library = client.get("/api/v1/governance/evidence-library")
    assert library.status_code == 200
    assert library.json()["total"] >= 1
