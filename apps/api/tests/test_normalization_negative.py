"""Negative normalization and detection cases — unrelated spans stay neutral."""

from __future__ import annotations

from app.detection.engine import evaluate_event
from app.db.models import DetectionRule
from app.pipeline.adapters.otel_agent import adapt_v2_span
from app.pipeline.normalizer import normalize_adapted
from app.simulator.generators.healthy_traffic import healthy_trace_bundle


def _event(bundle: dict, span_name: str):
    span = next(sp for sp in bundle["spans"] if sp["name"] == span_name)
    adapted = adapt_v2_span(bundle, span, timestamp="2026-06-02T14:22:01.123Z")
    return normalize_adapted(adapted, raw_event_id=f"raw-{span_name}")


def test_root_span_without_metrics_stays_neutral(db_session):
    bundle = healthy_trace_bundle("sys-agt-treasury-001", seed=10, seq=0)
    event = _event(bundle, "agent.request")
    assert event.normalized_signal_type is None
    rules = db_session.query(DetectionRule).all()
    assert evaluate_event(event, rules) is None


def test_healthy_retrieval_does_not_trigger_grounding(db_session):
    bundle = healthy_trace_bundle("sys-agt-treasury-001", seed=11, seq=0)
    event = _event(bundle, "retrieve.context")
    assert event.normalized_signal_type is None
    assert "grounding_score" not in event.evaluation_signals
    rules = db_session.query(DetectionRule).all()
    assert evaluate_event(event, rules) is None


def test_policy_allow_does_not_trigger_tool_scope(db_session):
    bundle = healthy_trace_bundle("sys-agt-phish-008", seed=12, seq=0)
    event = _event(bundle, "policy.evaluate")
    assert event.policy_result == "allow"
    rules = db_session.query(DetectionRule).all()
    assert evaluate_event(event, rules) is None


def test_approved_tool_does_not_trigger_tool_scope(db_session):
    bundle = healthy_trace_bundle("sys-agt-cs-002", seed=13, seq=0)
    event = _event(bundle, "route.select")
    assert event.evaluation_signals.get("tool_scope_violation", 0) == 0
    rules = db_session.query(DetectionRule).all()
    assert evaluate_event(event, rules) is None


def test_root_wall_clock_duration_does_not_trigger_latency(client, db_session):
    client.post("/api/v1/simulator/reset")
    bundle = healthy_trace_bundle("sys-agt-treasury-001", seed=14, seq=0)
    root = next(sp for sp in bundle["spans"] if sp["name"] == "agent.request")
    adapted = adapt_v2_span(bundle, root, timestamp="2026-06-02T14:22:01.123Z")
    assert float(adapted["evaluation_signals"].get("span_duration_ms", 0)) > 500
    assert adapted.get("latency_ms") is None or float(adapted["latency_ms"]) < 800

    resp = client.post("/api/v1/ingest/events", json=bundle)
    assert resp.status_code == 200
    db_session.expire_all()
    from app.db.models import Incident

    assert db_session.query(Incident).count() == 0


def test_healthy_ocr_does_not_trigger_extraction_incident():
    bundle = healthy_trace_bundle("sys-agt-inv-005", seed=15, seq=0)
    event = _event(bundle, "ocr.extract")
    assert event.normalized_signal_type is None


def test_single_abnormal_span_in_trace(client, db_session):
    client.post("/api/v1/simulator/reset")
    bundle = healthy_trace_bundle("sys-agt-treasury-001", seed=16, seq=0)
    claim = next(sp for sp in bundle["spans"] if sp["name"] == "evaluate.unsupported_claims")
    claim["evaluation"]["unsupported_claim_rate"] = 0.05

    resp = client.post("/api/v1/ingest/events", json=bundle)
    assert resp.status_code == 200
    db_session.expire_all()

    from app.db.models import NormalizedEvent

    norms = db_session.query(NormalizedEvent).filter(NormalizedEvent.trace_id == bundle["trace_id"]).all()
    governed = [n for n in norms if n.normalized_signal_type]
    neutral = [n for n in norms if not n.normalized_signal_type and not n.incident_id]
    assert len(governed) >= 1
    assert len(neutral) >= 3
    assert any((n.evaluation_signals or {}).get("span_name") == "evaluate.unsupported_claims" for n in governed)
