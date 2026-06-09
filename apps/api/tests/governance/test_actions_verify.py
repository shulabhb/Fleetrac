from __future__ import annotations

import pytest
from httpx import ASGITransport

from app.api.routes.simulator import run_scenario_with_transport
from app.db.session import get_session_factory
from app.slice_a.constants import INCIDENT_ALIAS_ID


@pytest.mark.asyncio
async def test_action_handoff_approve_reject(client, app):
    assert client.post("/api/v1/simulator/reset").status_code == 200
    transport = ASGITransport(app=app)
    factory = get_session_factory()
    db = factory()
    try:
        await run_scenario_with_transport(transport, db=db)
    finally:
        db.close()

    create = client.post(
        f"/api/v1/governance/incidents/{INCIDENT_ALIAS_ID}/actions",
        json={"execution_mode": "approval_required"},
    )
    assert create.status_code == 200
    action_id = create.json()["action_id"]

    reject = client.post(f"/api/v1/governance/actions/{action_id}/reject")
    assert reject.status_code == 200
    assert reject.json()["status"] == "Rejected"


@pytest.mark.asyncio
async def test_verification_regression_outcome(client, app):
    assert client.post("/api/v1/simulator/reset").status_code == 200
    transport = ASGITransport(app=app)
    factory = get_session_factory()
    db = factory()
    try:
        await run_scenario_with_transport(transport, db=db)
    finally:
        db.close()

    create = client.post(
        f"/api/v1/governance/incidents/{INCIDENT_ALIAS_ID}/actions",
        json={"execution_mode": "approval_required"},
    )
    action_id = create.json()["action_id"]
    client.post(f"/api/v1/governance/actions/{action_id}/approve")

    verify = client.post(
        f"/api/v1/governance/actions/{action_id}/verify",
        json={"outcome": "regression_detected", "summary": "Signal worsened."},
    )
    assert verify.status_code == 200

    dash = client.get("/api/v1/governance/dashboard-summary").json()
    assert dash["verification_follow_up"] >= 1 or dash["verification_rollback"] >= 0
