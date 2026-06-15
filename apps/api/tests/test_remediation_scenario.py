from __future__ import annotations


def test_remediation_applied_scenario(client):
    client.post("/api/v1/simulator/reset")
    resp = client.post(
        "/api/v1/simulator/scenarios/remediation_applied",
        json={"system_id": "sys-agt-treasury-001"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["posted"] == 5
    assert body["scenario"] == "remediation_applied"
