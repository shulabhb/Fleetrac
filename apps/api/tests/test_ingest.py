from __future__ import annotations

import time

from app.db.models import NormalizedEvent, RawEvent
from app.slice_a.constants import SYSTEM_ID


def _sample_payload(idem: str = "test-ingest-1") -> dict:
    return {
        "schema_version": "1.0",
        "source_type": "langgraph_trace",
        "source_provider": "internal",
        "source_service": "agent-orchestrator",
        "tenant_id": "tenant-demo",
        "environment": "production",
        "system_id": SYSTEM_ID,
        "trace_id": "a" * 32,
        "span_id": "b" * 16,
        "timestamp": "2026-06-02T14:22:01.123Z",
        "operation": "model_call",
        "evaluation": {"grounding_score": 0.9, "unsupported_claim_rate": 0.01},
        "idempotency_key": idem,
    }


def test_ingest_persists_raw_and_normalized(client):
    client.post("/api/v1/simulator/reset")
    response = client.post("/api/v1/ingest/events", json=_sample_payload())
    assert response.status_code == 200
    body = response.json()
    assert body["duplicate"] is False
    assert body["raw_event_id"]
    assert body["event_id"]

    dup = client.post("/api/v1/ingest/events", json=_sample_payload())
    assert dup.status_code == 200
    assert dup.json()["duplicate"] is True


def test_ingest_idempotency(client):
    client.post("/api/v1/simulator/reset")
    payload = _sample_payload("idem-xyz")
    first = client.post("/api/v1/ingest/events", json=payload).json()
    second = client.post("/api/v1/ingest/events", json=payload).json()
    assert first["raw_event_id"] == second["raw_event_id"]


def test_ingest_log_returns_raw_payloads(client):
    client.post("/api/v1/simulator/reset")
    client.post("/api/v1/ingest/events", json=_sample_payload("ingest-log-test"))
    log = client.get("/api/v1/governance/ingest-log", params={"limit": 10}).json()
    assert log["total"] >= 1
    row = log["items"][0]
    assert row["raw_payload"]["idempotency_key"] == "ingest-log-test"
    assert row["normalized"] is not None
    assert row["normalized"]["event_id"]


def test_ingest_log_since_cursor_returns_only_newer(client):
    client.post("/api/v1/simulator/reset")
    client.post("/api/v1/ingest/events", json=_sample_payload("ingest-log-first"))
    first = client.get("/api/v1/governance/ingest-log", params={"limit": 5}).json()
    assert first["total"] >= 1
    cursor = first["items"][0]["ingested_at"]

    time.sleep(1.1)
    client.post("/api/v1/ingest/events", json=_sample_payload("ingest-log-second"))
    delta = client.get(
        "/api/v1/governance/ingest-log",
        params={"limit": 10, "since": cursor},
    ).json()
    keys = {row["idempotency_key"] for row in delta["items"]}
    assert "ingest-log-second" in keys
    assert "ingest-log-first" not in keys
