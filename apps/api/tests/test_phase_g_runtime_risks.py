"""Phase G — runtime breach → risk create/update → evidence → owner queue."""

from __future__ import annotations

from datetime import datetime, timezone

from app.correlation.engine import process_correlation_event
from app.db.models import EvidenceItem, EvidenceRecord, Incident, SignalCluster
from app.detection.engine import DetectionMatch
from app.governance.read_models import evidence_for_incident, owner_queue
from app.governance.risk_snapshot import evidence_explanation
from app.schemas.fleetrac_event import FleetracEvent


def _event(
    *,
    system_id: str = "sys-agt-treasury-001",
    signal_type: str | None = "unsupported_claim_elevated",
    signal_state: str = "governance",
    trace_id: str = "trace-g1",
    span_id: str = "span-g1",
    evaluation: dict | None = None,
    event_id: str | None = None,
) -> FleetracEvent:
    return FleetracEvent(
        event_id=event_id or f"evt-{span_id}",
        timestamp=datetime(2026, 10, 9, 12, 0, 0, tzinfo=timezone.utc),
        tenant_id="tenant-demo",
        environment="production",
        source_provider="internal",
        source_service="agent-orchestrator",
        source_type="otel_agent_trace",
        system_id=system_id,
        trace_id=trace_id,
        span_id=span_id,
        operation_type="output_evaluation",
        model="Test Model",
        tool=None,
        latency_ms=None,
        evaluation_signals={
            "span_name": "evaluate.unsupported_claims",
            "unsupported_claim_rate": 0.041,
            **(evaluation or {}),
        },
        policy_result=None,
        signal_state=signal_state,  # type: ignore[arg-type]
        normalized_signal_type=signal_type,
        severity="critical",
        confidence=0.9,
        evidence_reference=None,
        raw_payload_reference="raw-g1",
        raw_envelope_id="raw-g1",
        accountable_owner_team="Model Risk Management",
        owner_team="Model Risk Management",
        applicable_control_ids=[],
        correlation_key="idle",
        content_mode="metadata_only",
        payload_hash="sha256:phase-g",
    )


def _match(
    *,
    metric_value: float = 0.041,
    severity: str = "critical",
) -> DetectionMatch:
    return DetectionMatch(
        rule_id="rule_unsupported_claim_high",
        signal_type="unsupported_claim_elevated",
        severity=severity,
        risk_category="Output Reliability",
        priority="P1",
        lifecycle_final="Owner Review",
        metric_value=metric_value,
        threshold_value=0.03,
    )


def test_healthy_event_does_not_create_risk(db_session):
    healthy = _event(signal_type=None, signal_state="healthy", evaluation={"latency_ms": 200})
    result = process_correlation_event(db_session, healthy)
    db_session.commit()
    assert result is None
    assert db_session.query(Incident).count() == 0


def test_first_breach_creates_risk_with_snapshot_and_evidence(db_session):
    event = _event()
    incident_id = process_correlation_event(db_session, event, match=_match())
    db_session.commit()

    assert incident_id is not None
    inc = db_session.get(Incident, incident_id)
    assert inc is not None
    assert inc.alias_id == "inc-mrm-001"
    assert inc.metric_name == "unsupported_claim_rate"
    assert inc.threshold_value == 0.03
    assert inc.latest_observed_value == 0.041
    assert inc.worst_observed_value == 0.041
    assert inc.control_name
    assert inc.trigger_event_id == event.event_id
    assert inc.recommended_next_step
    assert inc.occurrence_count == 1

    record = db_session.query(EvidenceRecord).filter(EvidenceRecord.incident_id == inc.id).one()
    items = db_session.query(EvidenceItem).filter(EvidenceItem.evidence_record_id == record.id).all()
    assert len(items) >= 1
    assert any("unsupported claim" in (i.summary or "").lower() or "0.041" in (i.summary or "") for i in items)


def test_second_breach_updates_same_risk(db_session):
    first = _event(span_id="span-a", trace_id="trace-a", event_id="evt-a")
    process_correlation_event(db_session, first, match=_match(metric_value=0.041))
    db_session.commit()

    second = _event(
        span_id="span-b",
        trace_id="trace-b",
        event_id="evt-b",
        evaluation={"unsupported_claim_rate": 0.055},
    )
    process_correlation_event(db_session, second, match=_match(metric_value=0.055))
    db_session.commit()

    assert db_session.query(Incident).count() == 1
    inc = db_session.query(Incident).one()
    assert inc.alias_id == "inc-mrm-001"
    assert inc.occurrence_count >= 2
    assert inc.latest_observed_value == 0.055
    assert inc.worst_observed_value == 0.055
    assert inc.trigger_event_id == "evt-b"
    opened = inc.opened_at

    # first_seen stable
    third = _event(span_id="span-c", trace_id="trace-c", event_id="evt-c")
    process_correlation_event(db_session, third, match=_match(metric_value=0.05))
    db_session.commit()
    db_session.expire_all()
    inc = db_session.query(Incident).one()
    assert inc.opened_at == opened
    assert inc.latest_observed_value == 0.05
    # worst stays at peak
    assert float(inc.worst_observed_value or 0) >= 0.055
    assert inc.occurrence_count == 3
    cluster = db_session.query(SignalCluster).one()
    assert len(cluster.contributing_event_ids) == 3
    assert len(cluster.contributing_trace_ids) == 3


def test_owner_queue_exposes_runtime_risk_fields(db_session):
    process_correlation_event(db_session, _event(), match=_match())
    db_session.commit()

    queue = owner_queue(db_session, owner_team="Model Risk Management")
    assert queue.total >= 1
    row = next(r for r in queue.items if r.alias_id == "inc-mrm-001")
    assert row.metric_name == "unsupported_claim_rate"
    assert row.threshold_value == 0.03
    assert row.latest_observed_value == 0.041
    assert row.control_name
    assert row.recommended_next_step
    assert row.rule_id == "rule_unsupported_claim_high"

    detail = evidence_for_incident(db_session, "inc-mrm-001")
    assert detail is not None
    assert detail.items
    assert any(item.summary for item in detail.items)


def test_phishing_and_platform_aliases(db_session):
    phish = _event(
        system_id="sys-agt-phish-008",
        signal_type="tool_scope_violation",
        span_id="phish-1",
        trace_id="phish-t",
        event_id="evt-phish",
        evaluation={"tool_scope_violation": 1.0, "span_name": "quarantine.route"},
    )
    phish_match = DetectionMatch(
        rule_id="rule_tool_scope_violation",
        signal_type="tool_scope_violation",
        severity="critical",
        risk_category="Cyber",
        priority="P1",
        lifecycle_final="Action Approval",
        metric_value=1.0,
        threshold_value=1.0,
    )
    process_correlation_event(db_session, phish, match=phish_match)

    cs = _event(
        system_id="sys-agt-cs-002",
        signal_type="latency_regression",
        span_id="cs-1",
        trace_id="cs-t",
        event_id="evt-cs",
        evaluation={"operation_latency_ms": 1200, "span_name": "model.reasoning"},
    )
    cs.operation_type = "model_call"
    cs_match = DetectionMatch(
        rule_id="rule_latency_high",
        signal_type="latency_regression",
        severity="medium",
        risk_category="Technology",
        priority="P2",
        lifecycle_final="Owner Review",
        metric_value=1200.0,
        threshold_value=800.0,
    )
    process_correlation_event(db_session, cs, match=cs_match)
    db_session.commit()

    aliases = {i.alias_id for i in db_session.query(Incident).all()}
    assert "inc-sec-001" in aliases
    assert "inc-plat-003" in aliases


def test_evidence_explanation_readable():
    text = evidence_explanation(
        system_id="sys-agt-treasury-001",
        match=_match(),
        occurrence_count=14,
        trace_id="abc-123",
    )
    assert "0.041" in text
    assert "0.03" in text
    assert "14" in text
    assert "Treasury" in text or "treasury" in text.lower() or "abc-123" in text
