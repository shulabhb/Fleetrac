"""Customer Support latency regression pitch scenario — full HTTP E2E."""

from __future__ import annotations

from app.db.models import Incident, NormalizedEvent, RawEvent
from app.simulator.scenarios.platform import scenario_trace_bundle
from tests.e2e.helpers import (
    assert_evidence_api,
    assert_owner_queue_contains,
    governed_span_names,
    incident_by_alias,
    reset_simulator,
    run_scenario_via_api,
    span_names_for_incident,
)

ALIAS = "inc-plat-003"
SYSTEM_ID = "sys-agt-cs-002"
CANONICAL = "inc_sys-agt-cs-002_latency_regression_001"


def test_cs_latency_regression_e2e(client, db_session):
    reset_simulator(client)
    run_scenario_via_api(client, "provider_latency_regression", SYSTEM_ID)
    db_session.expire_all()

    assert db_session.query(Incident).count() == 1
    inc = incident_by_alias(db_session, ALIAS)
    assert inc.id == CANONICAL
    assert inc.system_id == SYSTEM_ID
    assert inc.signal_type == "latency_regression"
    assert inc.classification_category == "Technology"
    assert inc.severity == "medium"
    assert inc.responder_team == "Platform Reliability"
    assert inc.accountable_owner_team == "Security Operations"

    governed = governed_span_names(db_session, inc.id)
    assert "model.reasoning" in governed

    latency_norm = (
        db_session.query(NormalizedEvent)
        .filter(
            NormalizedEvent.incident_id == inc.id,
            NormalizedEvent.normalized_signal_type == "latency_regression",
        )
        .one()
    )
    signals = latency_norm.evaluation_signals or {}
    assert float(signals.get("operation_latency_ms") or signals.get("latency_ms") or 0) > 800
    assert (signals.get("span_name") or "") == "model.reasoning"

    span_names = span_names_for_incident(db_session, inc.id)
    assert "model.reasoning" in span_names
    assert "route.select" in span_names or "queue.assign" in span_names

    assert_owner_queue_contains(client, "Platform Reliability", ALIAS)
    evidence = assert_evidence_api(client, ALIAS, CANONICAL)
    summaries = " ".join(item["summary"] for item in evidence["items"])
    assert "model.reasoning" in summaries

    model_span = next(
        sp
        for sp in (
            db_session.query(RawEvent).order_by(RawEvent.ingested_at.desc()).first().payload.get("spans") or []
        )
        if sp.get("name") == "model.reasoning"
    )
    assert float((model_span.get("evaluation") or {}).get("retry_count", 0)) >= 2


def test_cs_latency_recurrence_correlates(client, db_session):
    reset_simulator(client)
    run_scenario_via_api(client, "provider_latency_regression", SYSTEM_ID)
    first_count = db_session.query(Incident).count()

    bundle2 = scenario_trace_bundle(SYSTEM_ID, "provider_latency_regression", seed=44, seq=1)
    resp = client.post("/api/v1/ingest/events", json=bundle2)
    assert resp.status_code == 200
    db_session.expire_all()

    assert db_session.query(Incident).count() == first_count
    inc = incident_by_alias(db_session, ALIAS)
    assert inc.alias_id == ALIAS
