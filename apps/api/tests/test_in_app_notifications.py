"""In-app bell: one current row per risk, hidden legacy channel copies."""

from __future__ import annotations

from datetime import datetime, timezone

from app.correlation.engine import process_correlation_event
from app.db.models import GovernedActionRow, Incident, Notification
from app.detection.engine import DetectionMatch
from app.governance.actions import approve_action
from app.governance.notifications import list_current_notifications, notify_severity_escalation
from app.governance.verification import verify_action
from app.schemas.fleetrac_event import FleetracEvent


def _treasury(span: str) -> FleetracEvent:
    return FleetracEvent(
        event_id=f"evt-{span}",
        timestamp=datetime(2026, 10, 9, 12, 0, tzinfo=timezone.utc),
        tenant_id="tenant-demo",
        environment="production",
        source_provider="internal",
        source_service="agent-orchestrator",
        source_type="otel_agent_trace",
        system_id="sys-agt-treasury-001",
        trace_id=f"trace-{span}",
        span_id=span,
        operation_type="output_evaluation",
        model="Test Model",
        tool=None,
        latency_ms=None,
        evaluation_signals={
            "unsupported_claim_rate": 0.041,
            "span_name": "evaluate.unsupported_claims",
        },
        policy_result=None,
        signal_state="governance",
        normalized_signal_type="unsupported_claim_elevated",
        severity="critical",
        confidence=0.9,
        evidence_reference=None,
        raw_payload_reference="raw-note",
        raw_envelope_id="raw-note",
        accountable_owner_team="Model Risk Management",
        owner_team="Model Risk Management",
        applicable_control_ids=[],
        correlation_key="idle",
        content_mode="metadata_only",
        payload_hash="sha256:notes",
    )


def _match(severity: str = "critical") -> DetectionMatch:
    return DetectionMatch(
        rule_id="rule_unsupported_claim_high",
        signal_type="unsupported_claim_elevated",
        severity=severity,
        risk_category="Output Reliability",
        priority="P1",
        lifecycle_final="Owner Review",
        metric_value=0.041,
        threshold_value=0.03,
    )


def _visible(db) -> list[dict]:
    return list_current_notifications(db)


def _open_action(db, incident_id: str) -> GovernedActionRow:
    return (
        db.query(GovernedActionRow)
        .filter(GovernedActionRow.incident_id == incident_id)
        .one()
    )


def test_create_writes_one_in_app_decision(db_session):
    process_correlation_event(db_session, _treasury("create"), match=_match())
    rows = db_session.query(Notification).all()
    assert len(rows) == 1
    assert rows[0].channel == "in_app"
    assert rows[0].kind == "decision"
    visible = _visible(db_session)
    assert len(visible) == 1
    assert visible[0]["message"] == "inc-mrm-001 needs a decision. Review governed action."
    assert visible[0]["target"] == "action-center"
    assert visible[0]["alias_id"] == "inc-mrm-001"
    assert visible[0]["action_id"]


def test_legacy_slack_and_email_stay_hidden(db_session):
    process_correlation_event(db_session, _treasury("legacy"), match=_match())
    incident = db_session.query(Incident).one()
    db_session.add(
        Notification(
            id="legacy-slack",
            incident_id=incident.id,
            channel="slack",
            recipient="#model-risk",
            status="sent",
            message="[Fleetrac] assigned reviewer.",
        )
    )
    db_session.add(
        Notification(
            id="legacy-email",
            incident_id=incident.id,
            channel="email",
            recipient="lead@example.com",
            status="sent",
            message=f"Fleetrac packaged evidence for incident {incident.id}.",
        )
    )
    db_session.flush()
    visible = _visible(db_session)
    assert len(visible) == 1
    assert visible[0]["channel"] == "in_app"
    assert "needs a decision" in visible[0]["message"]
    assert db_session.query(Notification).count() == 3


def test_approve_and_verify_replace_the_same_risk_row(db_session):
    process_correlation_event(db_session, _treasury("loop"), match=_match())
    incident = db_session.query(Incident).one()
    action = _open_action(db_session, incident.id)

    approve_action(db_session, action)
    visible = _visible(db_session)
    assert len(visible) == 1
    assert visible[0]["kind"] == "verify"
    assert visible[0]["message"] == "inc-mrm-001 is approved. Verify impact."
    assert visible[0]["target"] == "action-center"
    verify_id = visible[0]["id"]

    verify_action(db_session, action=action, outcome="improvement_observed")
    visible = _visible(db_session)
    assert len(visible) == 1
    assert visible[0]["id"] != verify_id
    assert visible[0]["kind"] == "improvement"
    assert visible[0]["message"] == "inc-mrm-001 improved. View outcome evidence."
    assert visible[0]["target"] == "evidence"

    verify_action(db_session, action=action, outcome="improvement_observed")
    again = _visible(db_session)
    assert len(again) == 1
    assert again[0]["id"] == visible[0]["id"]


def test_rollback_and_follow_up_copy(db_session):
    process_correlation_event(db_session, _treasury("roll"), match=_match())
    incident = db_session.query(Incident).one()
    action = _open_action(db_session, incident.id)
    approve_action(db_session, action)

    verify_action(db_session, action=action, outcome="rollback_candidate")
    visible = _visible(db_session)
    assert visible[0]["message"] == "inc-mrm-001 is a rollback candidate. Review rollback path."
    assert visible[0]["target"] == "action-center"
    assert visible[0]["action_id"] == action.id

    verify_action(db_session, action=action, outcome="no_material_change")
    visible = _visible(db_session)
    assert len(visible) == 1
    assert visible[0]["message"] == "inc-mrm-001 shows no material change. Review follow-up."
    assert visible[0]["kind"] == "follow_up"


def test_severity_escalation_notifies_once(db_session):
    process_correlation_event(db_session, _treasury("sev-a"), match=_match())
    incident = db_session.query(Incident).one()
    incident.severity = "medium"
    db_session.flush()

    escalated = _treasury("sev-b")
    escalated.evaluation_signals = {
        **escalated.evaluation_signals,
        "citation_verified": False,
    }
    process_correlation_event(db_session, escalated, match=_match())
    first = _visible(db_session)
    assert len(first) == 1
    assert first[0]["message"] == "inc-mrm-001 severity raised to critical. Review risk."
    assert first[0]["target"] == "incident-queue"

    process_correlation_event(db_session, _treasury("sev-c"), match=_match())
    notify_severity_escalation(db_session, incident, previous="critical", new="critical")
    notify_severity_escalation(db_session, incident, previous="high", new="medium")
    second = _visible(db_session)
    assert len(second) == 1
    assert second[0]["id"] == first[0]["id"]


def test_later_breach_on_closed_risk_is_regression(db_session):
    process_correlation_event(db_session, _treasury("reg-a"), match=_match())
    incident = db_session.query(Incident).one()
    action = _open_action(db_session, incident.id)
    approve_action(db_session, action)
    verify_action(db_session, action=action, outcome="improvement_observed")
    assert incident.lifecycle == "Closed"

    process_correlation_event(db_session, _treasury("reg-b"), match=_match())
    visible = _visible(db_session)
    assert len(visible) == 1
    assert visible[0]["kind"] == "regression"
    assert visible[0]["message"] == "inc-mrm-001 regressed after verification. Review risk."
    assert db_session.query(Incident).count() == 1
