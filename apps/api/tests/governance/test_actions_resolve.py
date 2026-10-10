from __future__ import annotations

from app.slice_a.constants import INCIDENT_ALIAS_ID, SYSTEM_ID
from tests.e2e.helpers import reset_simulator, run_scenario_via_api


def _create_and_approve(client) -> str:
    create = client.post(
        f"/api/v1/governance/incidents/{INCIDENT_ALIAS_ID}/actions",
        json={"execution_mode": "approval_required"},
    )
    assert create.status_code == 200
    action_id = create.json()["action_id"]
    approve = client.post(f"/api/v1/governance/actions/{action_id}/approve")
    assert approve.status_code == 200
    return action_id


def _action(client, action_id: str) -> dict:
    items = client.get("/api/v1/governance/actions").json()["items"]
    return next(row for row in items if row["id"] == action_id)


def test_resolve_rollback_required_does_not_duplicate_or_execute(client):
    reset_simulator(client)
    run_scenario_via_api(client, "unsupported_claim_spike", SYSTEM_ID)
    action_id = _create_and_approve(client)
    verify = client.post(
        f"/api/v1/governance/actions/{action_id}/verify",
        json={"outcome": "rollback_candidate", "summary": "Blast radius expanded."},
    )
    assert verify.status_code == 200

    before = client.get("/api/v1/governance/actions").json()["items"]
    resolve = client.post(
        f"/api/v1/governance/actions/{action_id}/resolve",
        json={"resolution_status": "rollback_required"},
    )
    assert resolve.status_code == 200
    assert resolve.json()["resolution_status"] == "rollback_required"
    assert "did not execute rollback" in (resolve.json()["resolution_note"] or "").lower()

    after = client.get("/api/v1/governance/actions").json()["items"]
    matching = [row for row in after if row["id"] == action_id or row.get("alias_id") == INCIDENT_ALIAS_ID]
    assert len(matching) == 1
    row = _action(client, action_id)
    assert row["resolution_status"] == "rollback_required"
    assert row["status"] == "Rollback candidate"
    evidence = client.get(f"/api/v1/governance/evidence/{INCIDENT_ALIAS_ID}").json()
    assert evidence["lifecycle"] != "Closed"
    assert len(after) <= len(before)


def test_resolve_follow_up_and_resolved(client):
    reset_simulator(client)
    run_scenario_via_api(client, "unsupported_claim_spike", SYSTEM_ID)
    action_id = _create_and_approve(client)
    client.post(
        f"/api/v1/governance/actions/{action_id}/verify",
        json={"outcome": "no_material_change", "summary": "Metric did not move."},
    )
    follow = client.post(
        f"/api/v1/governance/actions/{action_id}/resolve",
        json={"resolution_status": "follow_up_assigned"},
    )
    assert follow.status_code == 200
    row = _action(client, action_id)
    assert row["resolution_status"] == "follow_up_assigned"
    assert client.get(f"/api/v1/governance/evidence/{INCIDENT_ALIAS_ID}").json()["lifecycle"] != "Closed"

    reset_simulator(client)
    run_scenario_via_api(client, "unsupported_claim_spike", SYSTEM_ID)
    action_id = _create_and_approve(client)
    client.post(
        f"/api/v1/governance/actions/{action_id}/verify",
        json={"outcome": "improvement_observed", "summary": "Metric improved."},
    )
    closed = client.post(
        f"/api/v1/governance/actions/{action_id}/resolve",
        json={"resolution_status": "resolved"},
    )
    assert closed.status_code == 200
    assert closed.json()["incident_lifecycle"] == "Closed"
    queue = client.get(
        "/api/v1/governance/owner-queue",
        params={"owner_team": "Model Risk Management"},
    ).json()
    open_items = [item for item in queue["items"] if item.get("lifecycle") != "Closed"]
    assert all(
        (item.get("alias_id") or item.get("id")) != INCIDENT_ALIAS_ID for item in open_items
    )
    evidence = client.get(f"/api/v1/governance/evidence/{INCIDENT_ALIAS_ID}")
    assert evidence.status_code == 200
    assert evidence.json().get("items")


def test_unmeasured_improvement_stays_close_ready(client):
    reset_simulator(client)
    run_scenario_via_api(client, "unsupported_claim_spike", SYSTEM_ID)
    action_id = _create_and_approve(client)
    verify = client.post(
        f"/api/v1/governance/actions/{action_id}/verify",
        json={"outcome": "improvement_observed", "summary": "Operator labeled improvement."},
    )
    assert verify.status_code == 200
    row = _action(client, action_id)
    evidence = client.get(f"/api/v1/governance/evidence/{INCIDENT_ALIAS_ID}").json()
    if row.get("closure_state") == "closed":
        assert evidence["lifecycle"] == "Closed"
    else:
        assert evidence["lifecycle"] != "Closed"
        assert row["current_stage"] == "VERIFICATION_IMPROVED"
        assert row["closure_state"] == "close_ready"


def test_regression_next_step_is_risk_detail(client):
    reset_simulator(client)
    run_scenario_via_api(client, "unsupported_claim_spike", SYSTEM_ID)
    action_id = _create_and_approve(client)
    client.post(
        f"/api/v1/governance/actions/{action_id}/verify",
        json={"outcome": "regression_detected", "summary": "Signal worsened."},
    )
    row = _action(client, action_id)
    assert row["status"] != "Rollback candidate"
    assert row["primary_destination"] == "risk_detail"
    assert "regression" in (row["verification_status"] or "").lower()


def test_resolve_rejects_unknown_status(client):
    reset_simulator(client)
    run_scenario_via_api(client, "unsupported_claim_spike", SYSTEM_ID)
    action_id = _create_and_approve(client)
    bad = client.post(
        f"/api/v1/governance/actions/{action_id}/resolve",
        json={"resolution_status": "execute_rollback"},
    )
    assert bad.status_code == 400
