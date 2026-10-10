"""Regressions from the seed-42 natural run, plus one HTTP smoke of that run.

The smoke test keeps seed 42 and only raises the emit rate so the same tick
sequence finishes inside the test. It does not write incidents except through
POST /api/v1/ingest/events.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone

from app.correlation.engine import process_correlation_event, reassess_cluster_for_incident
from app.db.models import EvidenceItem, EvidenceRecord, GovernedActionRow, Incident, NormalizedEvent, SignalCluster
from app.detection.engine import DetectionMatch
from app.governance.read_models import dashboard_summary
from app.schemas.fleetrac_event import FleetracEvent
from app.simulator.engine import make_run_context, run_agent
from app.simulator.runner import stop_continuous


def _naive(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def _tool_event(index: int) -> FleetracEvent:
    return FleetracEvent(
        event_id=f"evt-burst-{index}",
        timestamp=datetime(2026, 10, 10, 18, 50, index, tzinfo=timezone.utc),
        tenant_id="tenant-demo",
        environment="production",
        source_provider="internal",
        source_service="agent-orchestrator",
        source_type="otel_agent_trace",
        system_id="sys-agt-phish-008",
        trace_id=f"trace-burst-{index}",
        span_id=f"span-burst-{index}",
        operation_type="tool_call",
        model="Test Model",
        tool="refund_api_execute",
        latency_ms=40.0,
        evaluation_signals={
            "span_name": "quarantine.route",
            "tool_scope_violation": 1.0,
        },
        policy_result="deny",
        signal_state="governance",
        normalized_signal_type="tool_scope_violation",
        severity="critical",
        confidence=0.9,
        evidence_reference=None,
        raw_payload_reference=f"raw-burst-{index}",
        raw_envelope_id=f"raw-burst-{index}",
        accountable_owner_team="Security Operations",
        owner_team="Security Operations",
        applicable_control_ids=[],
        correlation_key="idle",
        content_mode="metadata_only",
        payload_hash="sha256:burst",
    )


def _match() -> DetectionMatch:
    return DetectionMatch(
        rule_id="rule_tool_scope_violation",
        signal_type="tool_scope_violation",
        severity="critical",
        risk_category="Cyber",
        priority="P1",
        lifecycle_final="Action Approval",
        metric_value=1.0,
        threshold_value=1.0,
    )


def test_repeated_burst_traces_update_the_same_cluster(db_session):
    """Occurrence must keep growing after the row is reloaded, and last_seen moves."""
    for index in range(4):
        process_correlation_event(db_session, _tool_event(index), match=_match())
        db_session.commit()
        db_session.expire_all()

    incident = db_session.query(Incident).one()
    reassess_cluster_for_incident(db_session, incident.id)
    db_session.commit()
    db_session.expire_all()

    incident = db_session.query(Incident).one()
    cluster = db_session.query(SignalCluster).one()
    assert incident.alias_id == "inc-sec-001"
    assert db_session.query(Incident).count() == 1
    assert incident.occurrence_count == 4
    assert incident.occurrence_count > 2
    assert len(cluster.contributing_event_ids) == 4
    assert len(cluster.contributing_trace_ids) == 4
    assert _naive(incident.last_seen_at) == datetime(2026, 10, 10, 18, 50, 3)
    assert _naive(cluster.last_seen_at) == datetime(2026, 10, 10, 18, 50, 3)
    assert _naive(incident.last_seen_at) > datetime(2026, 10, 10, 18, 50, 0)

    record = db_session.query(EvidenceRecord).filter(EvidenceRecord.incident_id == incident.id).one()
    refs = {
        row.reference_id
        for row in db_session.query(EvidenceItem).filter(EvidenceItem.evidence_record_id == record.id)
    }
    assert "evt-burst-2" in refs
    assert "evt-burst-3" in refs


def _trace(system_id: str, scenario_id: str | None):
    ctx = make_run_context(seed=5, scenario_id=scenario_id, system_id=system_id)
    return run_agent(system_id, scenario_id, ctx)


def _eval_by_span(trace) -> dict[str, dict]:
    return {span.name: dict(span.evaluation or {}) for span in trace.spans}


def test_near_miss_stays_on_the_span_for_that_agent(client, db_session):
    phishing_healthy = _trace("sys-agt-phish-008", None)
    phishing_near = _trace("sys-agt-phish-008", "near_miss")
    support_healthy = _trace("sys-agt-cs-002", None)
    support_near = _trace("sys-agt-cs-002", "near_miss")

    phishing_changed = {
        name
        for name, fields in _eval_by_span(phishing_near).items()
        if fields != _eval_by_span(phishing_healthy).get(name)
    }
    assert phishing_changed <= {"quarantine.route", "tool.route"}
    for span in phishing_near.spans:
        assert "unsupported_claim_rate" not in span.evaluation
        assert float(span.evaluation.get("tool_scope_violation", 0)) < 1

    support_changed = {
        name
        for name, fields in _eval_by_span(support_near).items()
        if fields != _eval_by_span(support_healthy).get(name)
    }
    assert support_changed == {"model.reasoning"}
    latency = support_near.spans
    model = next(span for span in latency if span.name == "model.reasoning")
    assert float(model.evaluation["operation_latency_ms"]) < 800
    for span in support_near.spans:
        assert "unsupported_claim_rate" not in span.evaluation
        if span.name != "model.reasoning":
            assert "operation_latency_ms" not in span.evaluation

    from app.simulator.generators.mode_traffic import emit_bundle

    client.post("/api/v1/simulator/reset")
    for system_id in ("sys-agt-phish-008", "sys-agt-cs-002"):
        bundle = emit_bundle(system_id, mode="near_miss", seed=5, seq=0, simulator_run_id="near-miss-regression")
        response = client.post("/api/v1/ingest/events", json=bundle)
        assert response.status_code == 200
    db_session.expire_all()
    signals = [
        row.normalized_signal_type
        for row in db_session.query(NormalizedEvent).all()
        if row.normalized_signal_type
    ]
    assert "unsupported_claim_elevated" not in signals
    assert db_session.query(Incident).count() == 0


def _status(client) -> dict:
    return client.get("/api/v1/simulator/status").json()


def _wait_until(client, predicate, timeout: float = 40.0) -> dict:
    deadline = time.time() + timeout
    last: dict = {}
    while time.time() < deadline:
        last = _status(client)
        if predicate(last):
            return last
        time.sleep(0.2)
    raise AssertionError(f"timed out waiting for simulator status: {last}")


def test_seed_42_natural_run_smoke(client, db_session):
    from app.db.models import VerificationOutcomeRow

    stop_continuous()
    client.post("/api/v1/simulator/reset")
    started = client.post(
        "/api/v1/simulator/start",
        json={
            "mode": "continuous",
            "rate_eps": 5,
            "rate_profile": "baseline",
            "profile": "demo",
            "seed": 42,
        },
    )
    assert started.status_code == 200
    assert started.json()["seed"] == 42
    assert started.json()["systems"] == [
        "sys-agt-treasury-001",
        "sys-agt-phish-008",
        "sys-agt-cs-002",
        "sys-agt-rag-007",
        "sys-agt-access-009",
    ]
    try:
        _wait_until(client, lambda status: (status.get("events_emitted") or 0) >= 8)
        db_session.expire_all()
        first = db_session.query(NormalizedEvent).order_by(NormalizedEvent.timestamp.asc()).first()
        assert first is not None
        assert first.normalized_signal_type is None
        assert db_session.query(Incident).count() == 0

        _wait_until(client, lambda status: (status.get("events_emitted") or 0) >= 30)
        db_session.expire_all()
        assert db_session.query(Incident).count() == 0
        assert (
            db_session.query(NormalizedEvent)
            .filter(NormalizedEvent.normalized_signal_type == "unsupported_claim_elevated")
            .count()
            == 0
        )

        _wait_until(client, lambda status: (status.get("events_emitted") or 0) >= 53)
        db_session.expire_all()
        incidents = db_session.query(Incident).all()
        assert len(incidents) == 1
        incident = incidents[0]
        assert incident.alias_id == "inc-sec-001"
        assert incident.system_id == "sys-agt-phish-008"
        assert incident.occurrence_count >= 4
        assert incident.lifecycle != "Closed"

        _wait_until(client, lambda status: (status.get("events_emitted") or 0) >= 57)
        db_session.expire_all()
        incident = db_session.query(Incident).one()
        assert incident.occurrence_count >= 6
        action = db_session.query(GovernedActionRow).filter(GovernedActionRow.incident_id == incident.id).one()
        approved = client.post(f"/api/v1/governance/actions/{action.id}/approve")
        assert approved.status_code == 200
        assert approved.json()["status"] == "Approved"

        def _post_action_sample() -> bool:
            db_session.expire_all()
            current = db_session.get(GovernedActionRow, action.id)
            if current is None or current.updated_at is None:
                return False
            return (
                db_session.query(NormalizedEvent)
                .filter(
                    NormalizedEvent.system_id == "sys-agt-phish-008",
                    NormalizedEvent.normalized_signal_type == "tool_scope_violation",
                    NormalizedEvent.timestamp >= current.updated_at,
                )
                .count()
                >= 1
            )

        deadline = time.time() + 25
        while time.time() < deadline and not _post_action_sample():
            time.sleep(0.2)
        assert _post_action_sample()
        stop_continuous()

        verified = client.post(
            f"/api/v1/governance/actions/{action.id}/verify",
            json={"outcome": "", "summary": ""},
        )
        assert verified.status_code == 200
        body = verified.json()
        assert body["outcome"] == "no_material_change"
        assert body["used_story_fallback"] is False
        assert "post-action telemetry" in body["verification_summary"]

        db_session.expire_all()
        incident = db_session.query(Incident).one()
        assert incident.lifecycle != "Closed"
        outcome = db_session.query(VerificationOutcomeRow).one()
        assert outcome.outcome == "no_material_change"
        assert outcome.post_action_value == 1.0

        summary = dashboard_summary(db_session)
        assert summary["active_incidents"] == 1
        assert summary["actions_awaiting_approval"] == 0
        assert summary["decisions_needed"] == 0
        assert summary["verification_count"] == 1
        assert summary["verification_follow_up"] == 1
    finally:
        stop_continuous()
        client.post("/api/v1/simulator/stop")
