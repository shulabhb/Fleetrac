"""Phase H — runtime risk links one governed action and records verification."""

from __future__ import annotations

from datetime import datetime, timezone

from app.correlation.engine import process_correlation_event
from app.db.models import GovernedActionRow, VerificationOutcomeRow
from app.detection.engine import DetectionMatch
from app.governance.actions import approve_action
from app.governance.read_models import evidence_library
from app.governance.verification import verify_action
from app.schemas.fleetrac_event import FleetracEvent


def _event(
    *,
    system_id: str,
    signal_type: str,
    span_id: str,
    evaluation: dict,
    operation_type: str = "output_evaluation",
) -> FleetracEvent:
    return FleetracEvent(
        event_id=f"evt-{span_id}",
        timestamp=datetime(2026, 10, 9, 12, 0, tzinfo=timezone.utc),
        tenant_id="tenant-demo",
        environment="production",
        source_provider="internal",
        source_service="agent-orchestrator",
        source_type="otel_agent_trace",
        system_id=system_id,
        trace_id=f"trace-{span_id}",
        span_id=span_id,
        operation_type=operation_type,
        model="Test Model",
        tool=None,
        latency_ms=None,
        evaluation_signals=evaluation,
        policy_result=None,
        signal_state="governance",
        normalized_signal_type=signal_type,
        severity="high",
        confidence=0.9,
        evidence_reference=None,
        raw_payload_reference="raw-h",
        raw_envelope_id="raw-h",
        accountable_owner_team="Model Risk Management",
        owner_team="Model Risk Management",
        applicable_control_ids=[],
        correlation_key="idle",
        content_mode="metadata_only",
        payload_hash="sha256:phase-h",
    )


def _treasury(span: str = "t1"):
    return _event(
        system_id="sys-agt-treasury-001",
        signal_type="unsupported_claim_elevated",
        span_id=span,
        evaluation={"unsupported_claim_rate": 0.041, "span_name": "evaluate.unsupported_claims"},
    )


def _treasury_match(value: float = 0.041) -> DetectionMatch:
    return DetectionMatch(
        rule_id="rule_unsupported_claim_high",
        signal_type="unsupported_claim_elevated",
        severity="critical",
        risk_category="Output Reliability",
        priority="P1",
        lifecycle_final="Owner Review",
        metric_value=value,
        threshold_value=0.03,
    )


def test_breach_links_one_action_and_updates_do_not_duplicate(db_session):
    process_correlation_event(db_session, _treasury("a"), match=_treasury_match())
    db_session.commit()
    assert db_session.query(GovernedActionRow).count() == 1
    action = db_session.query(GovernedActionRow).one()
    assert action.alias_id == "inc-mrm-001"
    assert action.status == "Awaiting approval"
    assert action.expected_metric == "unsupported_claim_rate"
    assert action.expected_direction == "decrease"
    assert action.rollback_eligible is False
    assert action.expected_result == "improvement_observed"
    assert "Treasury" in action.title

    process_correlation_event(db_session, _treasury("b"), match=_treasury_match(0.05))
    db_session.commit()
    rows = db_session.query(GovernedActionRow).all()
    assert len(rows) == 1
    assert rows[0].id == action.id


def test_approve_then_auto_verify_flagship_outcomes(db_session):
    process_correlation_event(db_session, _treasury(), match=_treasury_match())

    phish = _event(
        system_id="sys-agt-phish-008",
        signal_type="tool_scope_violation",
        span_id="p1",
        evaluation={"tool_scope_violation": 1.0, "span_name": "quarantine.route"},
        operation_type="tool_call",
    )
    process_correlation_event(
        db_session,
        phish,
        match=DetectionMatch(
            rule_id="rule_tool_scope_violation",
            signal_type="tool_scope_violation",
            severity="critical",
            risk_category="Cyber",
            priority="P1",
            lifecycle_final="Action Approval",
            metric_value=1.0,
            threshold_value=1.0,
        ),
    )

    cs = _event(
        system_id="sys-agt-cs-002",
        signal_type="latency_regression",
        span_id="c1",
        evaluation={"operation_latency_ms": 1250, "span_name": "model.reasoning"},
        operation_type="model_call",
    )
    process_correlation_event(
        db_session,
        cs,
        match=DetectionMatch(
            rule_id="rule_latency_high",
            signal_type="latency_regression",
            severity="medium",
            risk_category="Technology",
            priority="P2",
            lifecycle_final="Owner Review",
            metric_value=1250.0,
            threshold_value=800.0,
        ),
    )
    db_session.commit()

    actions = {a.alias_id: a for a in db_session.query(GovernedActionRow).all()}
    assert set(actions) >= {"inc-mrm-001", "inc-sec-001", "inc-plat-003"}
    assert actions["inc-sec-001"].rollback_eligible is True
    assert actions["inc-plat-003"].expected_metric == "latency_ms"

    expected = {
        "inc-mrm-001": "improvement_observed",
        "inc-sec-001": "rollback_candidate",
        "inc-plat-003": "no_material_change",
    }
    for alias, outcome in expected.items():
        action = actions[alias]
        approve_action(db_session, action)
        assert action.status == "Approved"
        assert action.verification_status == "Monitoring"
        row = verify_action(db_session, action=action, outcome=None, summary="")
        db_session.commit()
        assert row.outcome == outcome
        assert row.metric_name
        assert row.baseline_value is not None
        assert row.summary

    library = evidence_library(db_session)
    by_alias = {item["alias_id"]: item for item in library["items"]}
    assert by_alias["inc-mrm-001"]["verification_outcome"] == "improvement_observed"
    assert by_alias["inc-sec-001"]["verification_outcome"] == "rollback_candidate"
    assert by_alias["inc-plat-003"]["verification_outcome"] == "no_material_change"
    assert db_session.query(VerificationOutcomeRow).count() == 3


def test_operator_outcome_is_preserved(db_session):
    process_correlation_event(db_session, _treasury("op"), match=_treasury_match())
    db_session.commit()
    action = db_session.query(GovernedActionRow).one()
    approve_action(db_session, action)
    row = verify_action(
        db_session,
        action=action,
        outcome="regression_detected",
        summary="Operator recorded a worsening signal.",
    )
    db_session.commit()
    assert row.outcome == "regression_detected"
    assert action.status == "Rollback candidate"
    assert "Operator recorded" in row.summary
