"""Action Center hygiene — one primary action per incident; legacy rows superseded."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from app.correlation.engine import process_correlation_event
from app.db.models import GovernedActionRow, Incident
from app.detection.engine import DetectionMatch
from app.governance.actions import ensure_action_for_incident, list_actions
from app.governance.verification import verify_action
from app.schemas.fleetrac_event import FleetracEvent


def _treasury_event() -> FleetracEvent:
    return FleetracEvent(
        event_id="evt-hygiene",
        timestamp=datetime(2026, 10, 9, 12, 0, tzinfo=timezone.utc),
        tenant_id="tenant-demo",
        environment="production",
        source_provider="internal",
        source_service="agent-orchestrator",
        source_type="otel_agent_trace",
        system_id="sys-agt-treasury-001",
        trace_id="trace-hygiene",
        span_id="span-hygiene",
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
        raw_payload_reference="raw-h",
        raw_envelope_id="raw-h",
        accountable_owner_team="Model Risk Management",
        owner_team="Model Risk Management",
        applicable_control_ids=[],
        correlation_key="idle",
        content_mode="metadata_only",
        payload_hash="sha256:hygiene",
    )


def _match() -> DetectionMatch:
    return DetectionMatch(
        rule_id="rule_unsupported_claim_high",
        signal_type="unsupported_claim_elevated",
        severity="critical",
        risk_category="Output Reliability",
        priority="P1",
        lifecycle_final="Owner Review",
        metric_value=0.041,
        threshold_value=0.03,
    )


def test_legacy_duplicate_is_superseded_and_recipe_stays_primary(db_session):
    process_correlation_event(db_session, _treasury_event(), match=_match())
    db_session.commit()

    recipe = db_session.query(GovernedActionRow).one()
    assert recipe.alias_id == "inc-mrm-001"
    assert recipe.expected_metric == "unsupported_claim_rate"
    incident = db_session.get(Incident, recipe.incident_id)
    assert incident is not None

    legacy = GovernedActionRow(
        id=f"act_legacy_{uuid.uuid4().hex[:8]}",
        incident_id=incident.id,
        alias_id=incident.alias_id,
        title="Remediate — Output Reliability Control Degradation — Treasury",
        owner_team=incident.owner_team,
        system_id=incident.system_id,
        system_name="Treasury Commentary Agent",
        risk_category=incident.classification_category,
        severity=incident.severity,
        execution_mode="approval_required",
        status="Approved",
        verification_status="Monitoring",
        recommended_action=incident.summary[:200],
        created_at=datetime.now(timezone.utc) + timedelta(minutes=5),
    )
    db_session.add(legacy)
    db_session.commit()

    visible = list_actions(db_session)
    treasury = [row for row in visible if row.alias_id == "inc-mrm-001"]
    assert len(treasury) == 1
    assert treasury[0].id == recipe.id
    assert treasury[0].expected_metric == "unsupported_claim_rate"

    db_session.refresh(legacy)
    assert legacy.status == "Superseded"
    assert legacy.verification_status == "Superseded"

    history = list_actions(db_session, include_history=True)
    assert any(row.id == legacy.id for row in history)

    again = ensure_action_for_incident(db_session, incident)
    db_session.commit()
    assert again.id == recipe.id
    assert db_session.query(GovernedActionRow).filter(GovernedActionRow.incident_id == incident.id).count() == 2


def test_verify_primary_still_records_improvement(db_session):
    process_correlation_event(db_session, _treasury_event(), match=_match())
    db_session.commit()
    action = db_session.query(GovernedActionRow).one()
    action.status = "Approved"
    action.verification_status = "Monitoring"
    row = verify_action(db_session, action=action, outcome=None, summary="")
    db_session.commit()
    assert row.outcome == "improvement_observed"
    assert action.alias_id == "inc-mrm-001"
