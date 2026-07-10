"""Regression: root span duration vs provider operation latency."""

from __future__ import annotations

from app.detection.engine import evaluate_event
from app.db.models import DetectionRule
from app.pipeline.adapters.otel_agent import adapt_v2_span
from app.simulator.generators.healthy_traffic import healthy_trace_bundle


def test_healthy_treasury_root_duration_not_provider_latency(db_session):
    bundle = healthy_trace_bundle("sys-agt-treasury-001", seed=20, seq=0)
    root = next(sp for sp in bundle["spans"] if sp["name"] == "agent.request")
    model = next(sp for sp in bundle["spans"] if sp["name"] == "model.generate")

    root_adapted = adapt_v2_span(bundle, root, timestamp="2026-06-02T14:22:01.123Z")
    model_adapted = adapt_v2_span(bundle, model, timestamp="2026-06-02T14:22:01.123Z")

    assert float(root_adapted["evaluation_signals"]["span_duration_ms"]) > 400
    assert root_adapted.get("latency_ms") is None
    assert float(model_adapted["evaluation_signals"]["operation_latency_ms"]) < 800

    rules = db_session.query(DetectionRule).all()
    from app.pipeline.normalizer import normalize_adapted

    root_event = normalize_adapted(root_adapted, raw_event_id="root")
    model_event = normalize_adapted(model_adapted, raw_event_id="model")
    assert evaluate_event(root_event, rules) is None
    assert evaluate_event(model_event, rules) is None


def test_healthy_treasury_ingest_no_latency_incident(client, db_session):
    client.post("/api/v1/simulator/reset")
    bundle = healthy_trace_bundle("sys-agt-treasury-001", seed=21, seq=0)
    resp = client.post("/api/v1/ingest/events", json=bundle)
    assert resp.status_code == 200
    assert resp.json().get("incident_id") is None

    db_session.expire_all()
    from app.db.models import Incident

    assert db_session.query(Incident).count() == 0
