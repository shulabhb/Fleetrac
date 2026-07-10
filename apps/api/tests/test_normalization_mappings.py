"""Focused normalization mapping audit for scoped OTEL spans."""

from __future__ import annotations

from app.detection.engine import evaluate_event
from app.db.models import DetectionRule
from app.pipeline.adapters.otel_agent import adapt_v2_span
from app.pipeline.normalizer import normalize_adapted
from app.simulator.generators.healthy_traffic import healthy_trace_bundle


def _adapt_normalize(bundle: dict, span_name: str, *, timestamp: str = "2026-06-02T14:22:01.123Z"):
    span = next(sp for sp in bundle["spans"] if sp["name"] == span_name)
    adapted = adapt_v2_span(bundle, span, timestamp=timestamp)
    return adapted, normalize_adapted(adapted, raw_event_id="raw-map")


def test_treasury_unsupported_claims_span_mapping():
    bundle = healthy_trace_bundle("sys-agt-treasury-001", seed=1, seq=0)
    claim = next(sp for sp in bundle["spans"] if sp["name"] == "evaluate.unsupported_claims")
    claim["evaluation"]["unsupported_claim_rate"] = 0.041

    _, event = _adapt_normalize(bundle, "evaluate.unsupported_claims")
    assert event.operation_type == "output_evaluation"
    assert event.normalized_signal_type == "unsupported_claim_elevated"
    assert event.severity == "critical"
    assert event.confidence is not None
    assert event.evaluation_signals["span_name"] == "evaluate.unsupported_claims"


def test_treasury_grounding_degraded_mapping():
    bundle = healthy_trace_bundle("sys-agt-treasury-001", seed=2, seq=0)
    ground = next(sp for sp in bundle["spans"] if sp["name"] == "evaluate.grounding")
    ground["evaluation"]["grounding_score"] = 0.65

    _, event = _adapt_normalize(bundle, "evaluate.grounding")
    assert event.normalized_signal_type == "grounding_degraded"
    assert event.severity == "high"
    assert event.evaluation_signals["span_name"] == "evaluate.grounding"


def test_treasury_citation_failure_mapping():
    bundle = healthy_trace_bundle("sys-agt-treasury-001", seed=3, seq=0)
    verify = next(sp for sp in bundle["spans"] if sp["name"] == "verify.citations")
    verify["evaluation"]["missing_citation_fallback"] = 1.0

    _, event = _adapt_normalize(bundle, "verify.citations")
    assert event.normalized_signal_type == "missing_citation_fallback"
    assert event.severity == "high"


def test_phish_tool_scope_mapping(db_session):
    bundle = healthy_trace_bundle("sys-agt-phish-008", seed=4, seq=0)
    tool = next(sp for sp in bundle["spans"] if sp["name"] == "quarantine.route")
    tool["evaluation"]["tool_scope_violation"] = 1.0
    tool["policy_result"] = "deny"
    tool["attributes"]["fleetrac.tool.approved"] = False

    adapted, event = _adapt_normalize(bundle, "quarantine.route")
    assert adapted["policy_result"] == "deny"
    rules = db_session.query(DetectionRule).filter(DetectionRule.enabled.is_(True)).all()
    match = evaluate_event(event, rules)
    assert match is not None
    assert match.signal_type == "tool_scope_violation"
    assert match.risk_category == "Cyber"
    assert match.severity == "critical"


def test_cs_latency_mapping(db_session):
    bundle = healthy_trace_bundle("sys-agt-cs-002", seed=5, seq=0)
    model = next(sp for sp in bundle["spans"] if sp["name"] == "model.reasoning")
    model["evaluation"]["latency_ms"] = 1250.0
    model["latency_ms"] = 1250.0

    _, event = _adapt_normalize(bundle, "model.reasoning")
    assert float(event.evaluation_signals.get("operation_latency_ms") or 0) == 1250.0
    rules = db_session.query(DetectionRule).filter(DetectionRule.enabled.is_(True)).all()
    match = evaluate_event(event, rules)
    assert match is not None
    assert match.signal_type == "latency_regression"
    assert match.risk_category == "Technology"


def test_invoice_ocr_degraded_mapping():
    bundle = healthy_trace_bundle("sys-agt-inv-005", seed=6, seq=0)
    ocr = next(sp for sp in bundle["spans"] if sp["name"] == "ocr.extract")
    ocr["evaluation"]["ocr_confidence"] = 0.62

    _, event = _adapt_normalize(bundle, "ocr.extract")
    assert event.normalized_signal_type == "extraction_quality_degraded"
    assert event.severity == "medium"


def test_healthy_model_span_is_neutral():
    bundle = healthy_trace_bundle("sys-agt-treasury-001", seed=7, seq=0)
    _, event = _adapt_normalize(bundle, "model.generate")
    assert event.normalized_signal_type is None
    assert event.severity is None
    assert event.confidence is None
    assert event.trace_id == bundle["trace_id"]
