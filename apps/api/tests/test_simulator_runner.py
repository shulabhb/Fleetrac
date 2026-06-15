from __future__ import annotations


def test_continuous_start_stop_via_api(client):
    client.post("/api/v1/simulator/reset")
    start = client.post(
        "/api/v1/simulator/start",
        json={"mode": "continuous", "rate_eps": 5, "seed": 11, "systems": ["sys-agt-treasury-001"]},
    )
    assert start.status_code == 200
    status = client.get("/api/v1/simulator/status").json()
    assert status["running"] is True
    client.post("/api/v1/simulator/stop")
    stopped = client.get("/api/v1/simulator/status").json()
    assert stopped["running"] is False


def test_simulator_run_batch(client):
    client.post("/api/v1/simulator/reset")
    resp = client.post(
        "/api/v1/simulator/runs",
        json={"count": 2, "seed": 3, "systems": ["sys-agt-treasury-001", "sys-agt-phish-008"]},
    )
    assert resp.status_code == 200
    assert resp.json()["posted"] == 2
