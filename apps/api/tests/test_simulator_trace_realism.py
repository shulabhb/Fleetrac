"""OTEL simulator trace realism — timing, scoped attributes, events, determinism."""

from __future__ import annotations

from datetime import datetime, timezone

from app.detection.engine import evaluate_event
from app.db.models import DetectionRule
from app.fleet.registry import SYSTEM_BY_ID
from app.pipeline.adapters.otel_agent import adapt_v2_span
from app.pipeline.normalizer import normalize_adapted
from app.simulator.engine import make_run_context, run_agent
from app.simulator.generators.healthy_traffic import healthy_trace_bundle
from app.simulator.scenarios.mutations import apply_scenario_mutation
from app.simulator.telemetry.serializer import trace_to_v2_bundle
from app.simulator.trace_builder import validate_trace_timing


def _base_ns(trace) -> int:
    return trace.spans[0].start_time_unix_nano


def test_trace_timing_hierarchy_all_systems():
    for system_id in SYSTEM_BY_ID:
        ctx = make_run_context(seed=42, system_id=system_id)
        trace = run_agent(system_id, None, ctx)
        errors = validate_trace_timing(trace.spans, _base_ns(trace))
        assert errors == [], f"{system_id}: {errors}"


def test_root_span_covers_descendants():
    ctx = make_run_context(seed=7, system_id="sys-agt-treasury-001")
    trace = run_agent("sys-agt-treasury-001", None, ctx)
    root = trace.spans[0]
    max_end = max(sp.end_time_unix_nano for sp in trace.spans)
    assert root.end_time_unix_nano >= max_end
    assert root.end_time_unix_nano >= root.start_time_unix_nano


def test_deterministic_topology_and_timing():
    ctx_a = make_run_context(seed=99, system_id="sys-agt-treasury-001")
    ctx_b = make_run_context(seed=99, system_id="sys-agt-treasury-001")
    ctx_a.start_time = ctx_b.start_time = datetime(2026, 6, 2, 12, 0, 0, tzinfo=timezone.utc)

    trace_a = run_agent("sys-agt-treasury-001", None, ctx_a)
    trace_b = run_agent("sys-agt-treasury-001", None, ctx_b)

    names_a = [sp.name for sp in trace_a.spans]
    names_b = [sp.name for sp in trace_b.spans]
    assert names_a == names_b

    for sp_a, sp_b in zip(trace_a.spans, trace_b.spans, strict=True):
        assert sp_a.name == sp_b.name
        assert sp_a.start_time_unix_nano == sp_b.start_time_unix_nano
        assert sp_a.end_time_unix_nano == sp_b.end_time_unix_nano


def test_evaluation_metrics_scoped_to_relevant_spans():
    bundle = healthy_trace_bundle("sys-agt-treasury-001", seed=3, seq=0)
    spans = {sp["name"]: sp for sp in bundle["spans"]}

    assert "unsupported_claim_rate" in spans["evaluate.unsupported_claims"]["evaluation"]
    assert "unsupported_claim_rate" not in spans["query.generate"]["evaluation"]
    assert "grounding_score" in spans["evaluate.grounding"]["evaluation"]
    assert "grounding_score" not in spans["model.generate"]["evaluation"]

    invoice = healthy_trace_bundle("sys-agt-inv-005", seed=3, seq=0)
    inv_spans = {sp["name"]: sp for sp in invoice["spans"]}
    assert "ocr_confidence" in inv_spans["ocr.extract"]["evaluation"]
    assert "ocr_confidence" not in inv_spans.get("field.validate", {}).get("evaluation", {})


def test_tool_metadata_only_on_tool_spans():
    bundle = healthy_trace_bundle("sys-agt-cs-002", seed=5, seq=0)
    for sp in bundle["spans"]:
        attrs = sp.get("attributes") or {}
        if sp["name"] in ("route.select", "queue.assign"):
            assert attrs.get("gen_ai.tool.name") or sp["operation"] == "tool_call"
        elif sp["name"] == "intent.classify":
            assert "gen_ai.tool.name" not in attrs


def test_structured_events_within_span_interval():
    bundle = healthy_trace_bundle("sys-agt-treasury-001", seed=11, seq=2)
    for sp in bundle["spans"]:
        start = int(sp["start_time_unix_nano"])
        end = int(sp["end_time_unix_nano"])
        for ev in sp.get("events") or []:
            ts = int(ev.get("time_unix_nano") or ev.get("timestamp_unix_nano") or start)
            assert start <= ts <= end, f"{sp['name']} event {ev.get('name')} outside span window"


def test_bundle_has_sparse_logs_and_events():
    bundle = healthy_trace_bundle("sys-agt-pep-003", seed=2, seq=1)
    event_count = sum(len(sp.get("events") or []) for sp in bundle["spans"])
    assert 1 <= event_count <= 12
    assert len(bundle.get("logs") or []) >= 1


def test_healthy_normalization_no_false_governance_incidents(client):
    client.post("/api/v1/simulator/reset")
    bundle = healthy_trace_bundle("sys-agt-treasury-001", seed=20, seq=0)
    resp = client.post("/api/v1/ingest/events", json=bundle)
    assert resp.status_code == 200

    from app.db.models import Incident, NormalizedEvent
    from app.db.session import get_session_factory

    db = get_session_factory()()
    try:
        norms = db.query(NormalizedEvent).filter(NormalizedEvent.trace_id == bundle["trace_id"]).all()
        assert len(norms) >= 3
        noisy = [
            n
            for n in norms
            if n.normalized_signal_type == "healthy_runtime_activity"
            or (n.signal_state == "governance" and n.normalized_signal_type is None)
        ]
        assert noisy == []
        assert db.query(Incident).count() == 0
    finally:
        db.close()


def test_detection_rules_still_fire_for_scenarios(client):
    client.post("/api/v1/simulator/reset")
    from app.db.models import DetectionRule
    from app.db.session import get_session_factory

    ctx = make_run_context(seed=1, system_id="sys-agt-treasury-001")
    trace = run_agent("sys-agt-treasury-001", "unsupported_claim_spike", ctx)
    bundle = trace_to_v2_bundle(trace, ctx=ctx)

    db = get_session_factory()()
    try:
        rules = db.query(DetectionRule).filter(DetectionRule.enabled.is_(True)).all()
    finally:
        db.close()

    matched = False
    for sp in bundle["spans"]:
        adapted = adapt_v2_span(bundle, sp, timestamp="2026-06-02T14:22:01.123Z")
        event = normalize_adapted(adapted, raw_event_id="raw-test")
        if evaluate_event(event, rules):
            matched = True
            break
    assert matched
