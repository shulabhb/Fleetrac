"""Healthy OTEL variation — bounded metrics, wait spans, outcomes, detection safety."""

from __future__ import annotations

from datetime import datetime, timezone

from app.db.models import DetectionRule, Incident
from app.detection.engine import evaluate_event
from app.fleet.registry import FLEET_SYSTEMS
from app.pipeline.adapters.otel_agent import adapt_v2_span
from app.pipeline.normalizer import normalize_adapted
from app.simulator.engine import make_run_context, run_agent
from app.simulator.generators.healthy_traffic import all_fleet_system_ids, healthy_trace_bundle
from app.simulator.telemetry.serializer import trace_to_v2_bundle
from app.simulator.trace_builder import validate_trace_timing

ALL_SYSTEM_IDS = all_fleet_system_ids()
DETECTION_THRESHOLDS = {
    "latency_ms": 800.0,
    "unsupported_claim_rate": 0.03,
    "retrieval_failure_rate": 0.08,
    "tool_scope_violation": 1.0,
    "grounding_score": 0.7,
}


def _base_ns(trace) -> int:
    return trace.spans[0].start_time_unix_nano


def _bundle_fingerprint(bundle: dict) -> dict:
    spans = []
    for sp in bundle["spans"]:
        spans.append(
            {
                "name": sp["name"],
                "operation": sp.get("operation"),
                "start": sp["start_time_unix_nano"],
                "end": sp["end_time_unix_nano"],
                "evaluation": dict(sp.get("evaluation") or {}),
                "outcome": (sp.get("attributes") or {}).get("fleetrac.business_outcome.status"),
            }
        )
    outcome = bundle.get("business_outcome") or {}
    return {
        "spans": spans,
        "outcome_status": outcome.get("status"),
        "outcome_type": outcome.get("type"),
    }


def _evaluate_bundle(bundle: dict, rules) -> list:
    matches = []
    for sp in bundle["spans"]:
        adapted = adapt_v2_span(bundle, sp, timestamp="2026-06-02T14:22:01.123Z")
        event = normalize_adapted(adapted, raw_event_id=f"raw-{sp['span_id']}")
        match = evaluate_event(event, rules)
        if match:
            matches.append((sp["name"], match))
    return matches


def _metric_values_across_traces(seeds: range, field: str) -> set:
    values: set = set()
    for seed in seeds:
        bundle = healthy_trace_bundle("sys-agt-treasury-001", seed=seed, seq=0)
        for sp in bundle["spans"]:
            ev = sp.get("evaluation") or {}
            if field in ev:
                values.add(ev[field])
    return values


def test_healthy_fleet_no_incidents_or_detection_matches(client, db_session):
    client.post("/api/v1/simulator/reset")
    rules = db_session.query(DetectionRule).filter_by(enabled=True).all()

    traces_checked = 0
    for seed in range(50):
        system_id = ALL_SYSTEM_IDS[seed % len(ALL_SYSTEM_IDS)]
        bundle = healthy_trace_bundle(system_id, seed=1000 + seed, seq=0)
        resp = client.post("/api/v1/ingest/events", json=bundle)
        assert resp.status_code == 200, f"{system_id} seed={seed}: {resp.text}"
        assert resp.json().get("incident_id") is None

        matches = _evaluate_bundle(bundle, rules)
        assert matches == [], f"{system_id} seed={seed}: detection matches {matches}"

        for sp in bundle["spans"]:
            ev = sp.get("evaluation") or {}
            if "latency_ms" in ev:
                assert float(ev["latency_ms"]) < DETECTION_THRESHOLDS["latency_ms"]
            if "unsupported_claim_rate" in ev:
                assert float(ev["unsupported_claim_rate"]) < DETECTION_THRESHOLDS["unsupported_claim_rate"]
            if "retrieval_failure_rate" in ev:
                assert float(ev["retrieval_failure_rate"]) < DETECTION_THRESHOLDS["retrieval_failure_rate"]
            if "grounding_score" in ev:
                assert float(ev["grounding_score"]) >= DETECTION_THRESHOLDS["grounding_score"]

        traces_checked += 1

    assert traces_checked >= 50

    db_session.expire_all()
    assert db_session.query(Incident).count() == 0


def test_same_seed_produces_identical_healthy_output():
    fixed = datetime(2026, 6, 2, 12, 0, 0, tzinfo=timezone.utc)
    for system_id in ("sys-agt-treasury-001", "sys-agt-refund-001", "sys-agt-phish-008"):
        ctx_a = make_run_context(seed=4242, system_id=system_id)
        ctx_b = make_run_context(seed=4242, system_id=system_id)
        ctx_a.start_time = ctx_b.start_time = fixed

        trace_a = run_agent(system_id, None, ctx_a)
        trace_b = run_agent(system_id, None, ctx_b)
        bundle_a = trace_to_v2_bundle(trace_a, ctx=ctx_a)
        bundle_b = trace_to_v2_bundle(trace_b, ctx=ctx_b)

        assert _bundle_fingerprint(bundle_a) == _bundle_fingerprint(bundle_b)


def test_different_seeds_produce_metric_variation():
    latency_values = _metric_values_across_traces(range(20), "latency_ms")
    assert len(latency_values) >= 3

    outcomes: set[str] = set()
    for seed in range(30):
        bundle = healthy_trace_bundle("sys-agt-refund-001", seed=seed, seq=0)
        outcome = bundle.get("business_outcome", {}).get("status")
        if outcome:
            outcomes.add(outcome)
    assert len(outcomes) >= 2


def test_healthy_wait_spans_normalize_neutral_without_operation_latency(db_session):
    rules = db_session.query(DetectionRule).all()
    wait_systems = (
        "sys-agt-refund-001",
        "sys-agt-access-009",
        "sys-agt-pep-003",
        "sys-agt-kyc-004",
        "sys-agt-inv-005",
        "sys-agt-reg-010",
    )
    found_wait = False
    for system_id in wait_systems:
        for seed in range(12):
            bundle = healthy_trace_bundle(system_id, seed=seed, seq=0)
            for sp in bundle["spans"]:
                if sp.get("operation") != "wait" and not sp["name"].endswith(".wait"):
                    continue
                found_wait = True
                adapted = adapt_v2_span(bundle, sp, timestamp="2026-06-02T14:22:01.123Z")
                event = normalize_adapted(adapted, raw_event_id=sp["span_id"])
                assert event.normalized_signal_type is None
                assert adapted.get("latency_ms") is None
                assert "operation_latency_ms" not in adapted["evaluation_signals"]
                assert evaluate_event(event, rules) is None

    assert found_wait, "expected at least one healthy wait span across systems"


def test_healthy_root_timing_valid_all_systems():
    for system in FLEET_SYSTEMS:
        ctx = make_run_context(seed=77, system_id=system.id)
        trace = run_agent(system.id, None, ctx)
        errors = validate_trace_timing(trace.spans, _base_ns(trace))
        assert errors == [], f"{system.id}: {errors}"
        root = trace.spans[0]
        max_end = max(sp.end_time_unix_nano for sp in trace.spans)
        assert root.end_time_unix_nano >= max_end


def test_abnormal_scenarios_still_trigger_detection(db_session):
    rules = db_session.query(DetectionRule).filter_by(enabled=True).all()

    claim_ctx = make_run_context(seed=1, system_id="sys-agt-treasury-001")
    claim_trace = run_agent("sys-agt-treasury-001", "unsupported_claim_spike", claim_ctx)
    claim_bundle = trace_to_v2_bundle(claim_trace, ctx=claim_ctx)
    assert _evaluate_bundle(claim_bundle, rules)

    phish_ctx = make_run_context(seed=2, system_id="sys-agt-phish-008")
    phish_trace = run_agent("sys-agt-phish-008", "tool_scope_violation", phish_ctx)
    phish_bundle = trace_to_v2_bundle(phish_trace, ctx=phish_ctx)
    assert _evaluate_bundle(phish_bundle, rules)

    cs_ctx = make_run_context(seed=3, system_id="sys-agt-cs-002")
    cs_trace = run_agent("sys-agt-cs-002", "provider_latency_regression", cs_ctx)
    cs_bundle = trace_to_v2_bundle(cs_trace, ctx=cs_ctx)
    assert _evaluate_bundle(cs_bundle, rules)
