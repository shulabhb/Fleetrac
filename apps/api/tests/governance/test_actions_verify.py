from __future__ import annotations

from app.slice_a.constants import INCIDENT_ALIAS_ID, SYSTEM_ID
from tests.e2e.helpers import reset_simulator, run_scenario_via_api


def test_action_handoff_approve_reject(client):
    reset_simulator(client)
    run_scenario_via_api(client, "unsupported_claim_spike", SYSTEM_ID)

    create = client.post(
        f"/api/v1/governance/incidents/{INCIDENT_ALIAS_ID}/actions",
        json={"execution_mode": "approval_required"},
    )
    assert create.status_code == 200
    action_id = create.json()["action_id"]

    reject = client.post(f"/api/v1/governance/actions/{action_id}/reject")
    assert reject.status_code == 200
    assert reject.json()["status"] == "Rejected"


def test_verification_regression_outcome(client):
    reset_simulator(client)
    run_scenario_via_api(client, "unsupported_claim_spike", SYSTEM_ID)

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
