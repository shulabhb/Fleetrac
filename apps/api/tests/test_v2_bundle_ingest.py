from __future__ import annotations

from app.services.ingest_validator import validate_envelope, validate_v2_bundle
from app.simulator.generators.healthy_traffic import healthy_trace_bundle


def test_v2_validator_rejects_bad_trace_id():
    bundle = healthy_trace_bundle("sys-agt-treasury-001", seed=1, seq=0)
    bundle["trace_id"] = "not-hex"
    result = validate_v2_bundle(bundle)
    assert not result.ok
    assert any("trace_id" in e for e in result.errors)


def test_v2_validator_accepts_healthy_bundle():
    bundle = healthy_trace_bundle("sys-agt-treasury-001", seed=1, seq=0)
    result = validate_envelope(bundle)
    assert result.ok, result.errors


def test_v2_bundle_ingest_fan_out(client):
    client.post("/api/v1/simulator/reset")
    bundle = healthy_trace_bundle("sys-agt-treasury-001", seed=99, seq=1)
    response = client.post("/api/v1/ingest/events", json=bundle)
    assert response.status_code == 200
    body = response.json()
    assert body["duplicate"] is False
    assert body.get("spans_accepted", 1) >= 2

    signals = client.get("/api/v1/governance/live-signals", params={"limit": 20}).json()
    trace_ids = {row["trace_id"] for row in signals["items"]}
    assert bundle["trace_id"] in trace_ids


def test_governance_systems_endpoint(client):
    client.post("/api/v1/simulator/reset")
    systems = client.get("/api/v1/governance/systems").json()
    assert systems["total"] == 10
    assert any(s["display_system_id"] == "M40" for s in systems["items"])


def test_simulator_scenarios_catalog(client):
    catalog = client.get("/api/v1/simulator/scenarios").json()
    implemented_ids = {s["id"] for s in catalog["implemented"]}
    assert "unsupported_claim_spike" in implemented_ids
    assert "provider_latency_regression" in implemented_ids
    assert len(catalog["planned"]) >= 1
