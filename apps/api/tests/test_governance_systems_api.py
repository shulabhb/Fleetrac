from __future__ import annotations

from app.simulator.generators.healthy_traffic import healthy_trace_bundle


def test_ingest_log_returns_normalized_spans(client):
    client.post("/api/v1/simulator/reset")
    bundle = healthy_trace_bundle("sys-agt-treasury-001", seed=7, seq=0)
    client.post("/api/v1/ingest/events", json=bundle)
    log = client.get("/api/v1/governance/ingest-log", params={"limit": 5}).json()
    row = log["items"][0]
    assert len(row.get("normalized_spans", [])) >= 2


def test_system_detail_and_telemetry_endpoints(client):
    client.post("/api/v1/simulator/reset")
    bundle = healthy_trace_bundle("sys-agt-treasury-001", seed=8, seq=1)
    client.post("/api/v1/ingest/events", json=bundle)

    detail = client.get("/api/v1/governance/systems/sys-agt-treasury-001").json()
    assert detail["display_system_id"] == "M40"

    signals = client.get(
        "/api/v1/governance/systems/sys-agt-treasury-001/signals", params={"limit": 10}
    ).json()
    assert signals["total"] >= 1
    assert signals["items"][0].get("trace_id")

    telemetry = client.get("/api/v1/governance/systems/sys-agt-treasury-001/telemetry").json()
    assert telemetry["total"] >= 1

    controls = client.get("/api/v1/governance/systems/sys-agt-treasury-001/controls").json()
    assert "items" in controls
