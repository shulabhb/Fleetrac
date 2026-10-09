"""Phase J — verification uses post-action telemetry when it exists."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from app.correlation.engine import process_correlation_event
from app.db.models import DetectionRule, GovernedActionRow, NormalizedEvent, VerificationOutcomeRow
from app.detection.engine import DetectionMatch, evaluate_event
from app.governance.actions import approve_action
from app.governance.verification import verify_action
from app.schemas.fleetrac_event import FleetracEvent


def _event(*, rate: float, span: str) -> FleetracEvent:
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
        evaluation_signals={"unsupported_claim_rate": rate, "span_name": "evaluate.unsupported_claims"},
        policy_result=None,
        signal_state="governance" if rate > 0.03 else "healthy",
        normalized_signal_type="unsupported_claim_elevated" if rate > 0.03 else None,
        severity="critical" if rate > 0.03 else None,
        confidence=0.9 if rate > 0.03 else None,
        evidence_reference=None,
        raw_payload_reference="raw-j",
        raw_envelope_id="raw-j",
        accountable_owner_team="Model Risk Management",
        owner_team="Model Risk Management",
        applicable_control_ids=[],
        correlation_key="idle",
        content_mode="metadata_only",
        payload_hash="sha256:phase-j",
    )


def _match(rate: float = 0.041) -> DetectionMatch:
    return DetectionMatch(
        rule_id="rule_unsupported_claim_high",
        signal_type="unsupported_claim_elevated",
        severity="critical",
        risk_category="Output Reliability",
        priority="P1",
        lifecycle_final="Owner Review",
        metric_value=rate,
        threshold_value=0.03,
    )


def _post_sample(db_session, *, system_id: str, metric_key: str, value: float, when: datetime) -> None:
    db_session.add(
        NormalizedEvent(
            id=str(uuid.uuid4()),
            event_id=str(uuid.uuid4()),
            timestamp=when,
            tenant_id="tenant-demo",
            environment="production",
            source_provider="internal",
            source_service="agent-orchestrator",
            source_type="otel_agent_trace",
            system_id=system_id,
            trace_id="trace-post",
            span_id="span-post",
            operation_type="output_evaluation",
            evaluation_signals={metric_key: value},
            raw_payload_reference="raw-post",
            correlation_key="post",
            signal_state="healthy",
        )
    )
    db_session.flush()


def test_below_threshold_does_not_match_rule(db_session):
    rules = db_session.query(DetectionRule).all()
    assert evaluate_event(_event(rate=0.02, span="soft"), rules) is None
    assert evaluate_event(_event(rate=0.041, span="breach"), rules) is not None


def test_post_action_telemetry_overrides_story_fallback(db_session):
    process_correlation_event(db_session, _event(rate=0.041, span="breach-1"), match=_match())
    db_session.commit()
    action = db_session.query(GovernedActionRow).one()
    assert action.expected_result == "improvement_observed"
    approve_action(db_session, action)
    action.updated_at = datetime.now(timezone.utc)
    db_session.flush()

    # Story expects improvement, but the sample worsened and rollback is not eligible.
    _post_sample(
        db_session,
        system_id=action.system_id,
        metric_key="unsupported_claim_rate",
        value=0.08,
        when=action.updated_at + timedelta(minutes=1),
    )
    worsened = verify_action(db_session, action=action, outcome=None, summary="")
    db_session.commit()
    assert worsened.outcome == "regression_detected"
    assert worsened.post_action_value == 0.08
    assert "post-action telemetry" in worsened.summary
    assert "Story fallback" not in worsened.summary

    # A later sample clears the threshold, so telemetry records improvement.
    _post_sample(
        db_session,
        system_id=action.system_id,
        metric_key="unsupported_claim_rate",
        value=0.01,
        when=action.updated_at + timedelta(minutes=2),
    )
    improved = verify_action(db_session, action=action, outcome=None, summary="")
    db_session.commit()
    assert improved.outcome == "improvement_observed"
    assert improved.post_action_value == 0.01
    assert db_session.query(VerificationOutcomeRow).filter(
        VerificationOutcomeRow.action_id == action.id
    ).count() == 2


def test_repeat_same_outcome_does_not_duplicate_row(db_session):
    process_correlation_event(db_session, _event(rate=0.041, span="repeat"), match=_match())
    db_session.commit()
    action = db_session.query(GovernedActionRow).one()
    approve_action(db_session, action)
    first = verify_action(db_session, action=action, outcome=None, summary="")
    second = verify_action(db_session, action=action, outcome=None, summary="")
    db_session.commit()
    assert first.id == second.id
    assert "Story fallback" in second.summary
    assert db_session.query(VerificationOutcomeRow).count() == 1
