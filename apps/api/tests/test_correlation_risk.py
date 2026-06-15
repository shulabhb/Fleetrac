"""Correlation and risk-assessment engine tests."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.correlation.engine import (
    candidate_from_event,
    find_active_cluster,
    is_correlation_eligible,
    process_correlation_event,
)
from app.correlation.families import (
    OUTPUT_RELIABILITY,
    PLATFORM_RELIABILITY,
    TOOL_GOVERNANCE,
    cluster_correlation_key,
    diagnosis_family_for,
)
from app.correlation.policies.output_reliability import OutputReliabilityPolicy
from app.correlation.policies.platform_reliability import PlatformReliabilityPolicy
from app.correlation.policies.tool_governance import ToolGovernancePolicy
from app.db.models import Incident, RiskAssessment, SeverityHistory, SignalCluster
from app.detection.engine import DetectionMatch
from app.fleet.registry import FLEET_SYSTEMS
from app.schemas.fleetrac_event import FleetracEvent
from app.simulator.scenarios.platform import scenario_trace_bundle
from tests.e2e.helpers import incident_by_alias, reset_simulator, run_scenario_via_api


def _event(
    *,
    system_id: str = "sys-agt-treasury-001",
    signal_type: str | None = "unsupported_claim_elevated",
    signal_state: str = "governance",
    trace_id: str = "trace-a",
    span_id: str = "span-a",
    evaluation: dict | None = None,
    timestamp: datetime | None = None,
) -> FleetracEvent:
    ts = timestamp or datetime(2026, 6, 2, 12, 0, 0, tzinfo=timezone.utc)
    return FleetracEvent(
        event_id=f"evt-{span_id}",
        timestamp=ts,
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
        raw_payload_reference="raw-1",
        raw_envelope_id="raw-1",
        accountable_owner_team="Model Risk Management",
        owner_team="Model Risk Management",
        applicable_control_ids=[],
        correlation_key="idle",
        content_mode="metadata_only",
        payload_hash="sha256:test",
    )


def _match(signal_type: str = "unsupported_claim_elevated") -> DetectionMatch:
    return DetectionMatch(
        rule_id="rule_unsupported_claim_high",
        signal_type=signal_type,
        severity="critical",
        risk_category="Output Reliability",
        priority="P1",
        lifecycle_final="Owner Review",
        metric_value=0.041,
        threshold_value=0.03,
    )


def test_cluster_correlation_key_excludes_trace_id():
    key = cluster_correlation_key(
        tenant_id="tenant-demo",
        environment="production",
        system_id="sys-agt-treasury-001",
        diagnosis_family=OUTPUT_RELIABILITY,
    )
    assert key == "tenant-demo:production:sys-agt-treasury-001:output_reliability_control_degradation"
    assert "trace" not in key


def test_diagnosis_family_maps_per_system():
    assert diagnosis_family_for("sys-agt-treasury-001", "unsupported_claim_elevated") == OUTPUT_RELIABILITY
    assert diagnosis_family_for("sys-agt-phish-008", "tool_scope_violation") == TOOL_GOVERNANCE
    assert diagnosis_family_for("sys-agt-cs-002", "latency_regression") == PLATFORM_RELIABILITY
    assert diagnosis_family_for("sys-agt-treasury-001", "latency_regression") is None


def test_neutral_span_not_correlation_eligible():
    healthy = _event(signal_type=None, signal_state="healthy", evaluation={"latency_ms": 400})
    assert is_correlation_eligible(healthy) is False


def test_wait_span_not_correlation_eligible():
    wait = _event(signal_type=None, signal_state="healthy", evaluation={"span_name": "approval.wait"})
    wait.operation_type = "wait"
    assert is_correlation_eligible(wait) is False


def test_cluster_window_reuse(db_session):
    event = _event()
    match = _match()
    process_correlation_event(db_session, event, match=match, business_outcome="held_for_review")
    db_session.commit()

    key = cluster_correlation_key(
        tenant_id="tenant-demo",
        environment="production",
        system_id="sys-agt-treasury-001",
        diagnosis_family=OUTPUT_RELIABILITY,
    )
    cluster = find_active_cluster(
        db_session,
        correlation_key=key,
        as_of=datetime(2026, 6, 2, 12, 5, 0, tzinfo=timezone.utc),
    )
    assert cluster is not None

    later = _event(trace_id="trace-b", span_id="span-b", timestamp=datetime(2026, 6, 2, 12, 10, 0, tzinfo=timezone.utc))
    process_correlation_event(db_session, later, match=match, business_outcome="held_for_review")
    db_session.commit()

    assert db_session.query(Incident).count() == 1
    cluster = db_session.query(SignalCluster).one()
    assert cluster.trace_count == 2


def test_cluster_window_expires(db_session):
    event = _event(timestamp=datetime(2026, 6, 2, 12, 0, 0, tzinfo=timezone.utc))
    process_correlation_event(db_session, event, match=_match())
    db_session.commit()

    key = cluster_correlation_key(
        tenant_id="tenant-demo",
        environment="production",
        system_id="sys-agt-treasury-001",
        diagnosis_family=OUTPUT_RELIABILITY,
    )
    outside = find_active_cluster(
        db_session,
        correlation_key=key,
        as_of=datetime(2026, 6, 2, 12, 20, 0, tzinfo=timezone.utc),
    )
    assert outside is None


def test_output_policy_contained_medium():
    cluster = SignalCluster(
        id="c1",
        tenant_id="t",
        environment="production",
        system_id="sys-agt-treasury-001",
        diagnosis_family=OUTPUT_RELIABILITY,
        correlation_key="k",
        window_start=datetime.now(timezone.utc),
        window_end=datetime.now(timezone.utc),
        first_seen_at=datetime.now(timezone.utc),
        last_seen_at=datetime.now(timezone.utc),
        occurrence_count=1,
        trace_count=1,
        signal_types=["unsupported_claim_elevated"],
        current_business_outcome="held_for_review",
    )
    candidates = [
        candidate_from_event(
            _event(evaluation={"unsupported_claim_rate": 0.041}),
            match=_match(),
            business_outcome="held_for_review",
        )
    ]
    assert candidates[0] is not None
    result = OutputReliabilityPolicy().evaluate_cluster(cluster, [candidates[0]])
    assert result.severity == "medium"


def test_output_policy_materialized_critical():
    cluster = SignalCluster(
        id="c2",
        tenant_id="t",
        environment="production",
        system_id="sys-agt-treasury-001",
        diagnosis_family=OUTPUT_RELIABILITY,
        correlation_key="k",
        window_start=datetime.now(timezone.utc),
        window_end=datetime.now(timezone.utc),
        first_seen_at=datetime.now(timezone.utc),
        last_seen_at=datetime.now(timezone.utc),
        occurrence_count=1,
        trace_count=1,
        signal_types=["unsupported_claim_elevated", "citation_control_failure"],
        current_business_outcome="published",
    )
    event = _event(
        evaluation={
            "unsupported_claim_rate": 0.041,
            "grounding_score": 0.76,
            "citation_verified": False,
        }
    )
    cand = candidate_from_event(event, match=_match(), business_outcome="published")
    assert cand is not None
    result = OutputReliabilityPolicy().evaluate_cluster(cluster, [cand])
    assert result.severity == "critical"


def test_tool_policy_blocked_vs_executed():
    policy = ToolGovernancePolicy()
    base_cluster = dict(
        tenant_id="t",
        environment="production",
        system_id="sys-agt-phish-008",
        diagnosis_family=TOOL_GOVERNANCE,
        correlation_key="k",
        window_start=datetime.now(timezone.utc),
        window_end=datetime.now(timezone.utc),
        first_seen_at=datetime.now(timezone.utc),
        last_seen_at=datetime.now(timezone.utc),
        occurrence_count=1,
        trace_count=1,
        signal_types=["tool_scope_violation"],
    )
    blocked = SignalCluster(id="tb", current_business_outcome="quarantined", **base_cluster)
    blocked_event = _event(
        system_id="sys-agt-phish-008",
        signal_type="tool_scope_violation",
        evaluation={"tool_scope_violation": 1.0, "span_name": "quarantine.route"},
    )
    blocked_event.policy_result = "deny"
    blocked_cand = candidate_from_event(
        blocked_event,
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
    assert blocked_cand is not None
    blocked_result = policy.evaluate_cluster(blocked, [blocked_cand])
    assert blocked_result.severity in ("medium", "high", "critical")

    executed = SignalCluster(id="te", current_business_outcome="unauthorized_action_executed", **base_cluster)
    executed_event = blocked_event
    executed_cand = candidate_from_event(executed_event, business_outcome="unauthorized_action_executed")
    assert executed_cand is not None
    executed_cand.relevant_attributes["tool_execution_succeeded"] = True
    executed_result = policy.evaluate_cluster(executed, [executed_cand])
    assert executed_result.severity == "critical"


def test_platform_policy_fallback_semantics():
    policy = PlatformReliabilityPolicy()
    cluster = SignalCluster(
        id="pc",
        tenant_id="t",
        environment="production",
        system_id="sys-agt-cs-002",
        diagnosis_family=PLATFORM_RELIABILITY,
        correlation_key="k",
        window_start=datetime.now(timezone.utc),
        window_end=datetime.now(timezone.utc),
        first_seen_at=datetime.now(timezone.utc),
        last_seen_at=datetime.now(timezone.utc),
        occurrence_count=1,
        trace_count=1,
        signal_types=["latency_regression"],
        current_business_outcome="routed",
    )
    event = _event(
        system_id="sys-agt-cs-002",
        signal_type="latency_regression",
        evaluation={"operation_latency_ms": 1250, "span_name": "model.reasoning", "retry_count": 1},
    )
    cand = candidate_from_event(
        event,
        match=DetectionMatch(
            rule_id="rule_latency_high",
            signal_type="latency_regression",
            severity="medium",
            risk_category="Technology",
            priority="P2",
            lifecycle_final="Owner Review",
            metric_value=1250,
            threshold_value=800,
        ),
        business_outcome="routed",
    )
    assert cand is not None
    contained = policy.evaluate_cluster(cluster, [cand])
    assert contained.severity == "medium"

    cluster.current_business_outcome = "routing_unavailable"
    cand.relevant_attributes["fallback_failed"] = True
    cand.relevant_attributes["provider_error"] = True
    materialized = policy.evaluate_cluster(cluster, [cand])
    assert materialized.severity == "critical"


def test_treasury_severity_progression_e2e(client, db_session):
    reset_simulator(client)
    run_scenario_via_api(client, "unsupported_claim_spike", "sys-agt-treasury-001", impact_mode="contained")
    inc = incident_by_alias(db_session, "inc-mrm-001")
    assert inc.severity == "medium"

    bundle2 = scenario_trace_bundle(
        "sys-agt-treasury-001",
        "unsupported_claim_spike",
        seed=42,
        seq=1,
        impact_mode="degraded",
    )
    client.post("/api/v1/ingest/events", json=bundle2)
    db_session.expire_all()
    inc = incident_by_alias(db_session, "inc-mrm-001")
    assert db_session.query(Incident).count() == 1
    assert inc.severity == "high"
    assert inc.highest_severity in ("high", "critical")

    bundle3 = scenario_trace_bundle(
        "sys-agt-treasury-001",
        "unsupported_claim_spike",
        seed=42,
        seq=2,
        impact_mode="materialized",
    )
    client.post("/api/v1/ingest/events", json=bundle3)
    db_session.expire_all()
    inc = incident_by_alias(db_session, "inc-mrm-001")
    assert inc.severity == "critical"
    history = db_session.query(SeverityHistory).filter(SeverityHistory.incident_id == inc.id).all()
    assert len(history) >= 2
    assert db_session.query(RiskAssessment).filter(RiskAssessment.incident_id == inc.id).count() >= 3


def test_healthy_traffic_no_cluster(client, db_session):
    reset_simulator(client)
    from app.simulator.generators.healthy_traffic import healthy_trace_bundle

    for i, system in enumerate(FLEET_SYSTEMS[:5]):
        bundle = healthy_trace_bundle(system.id, seed=200 + i, seq=0)
        resp = client.post("/api/v1/ingest/events", json=bundle)
        assert resp.status_code == 200
    db_session.expire_all()
    assert db_session.query(SignalCluster).count() == 0
    assert db_session.query(Incident).count() == 0
