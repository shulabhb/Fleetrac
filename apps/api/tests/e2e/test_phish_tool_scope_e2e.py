"""Phishing tool-scope violation pitch scenario — full HTTP E2E."""

from __future__ import annotations

from app.db.models import Incident, NormalizedEvent
from tests.e2e.helpers import (
    assert_evidence_api,
    assert_owner_queue_contains,
    governed_span_names,
    incident_by_alias,
    reset_simulator,
    run_scenario_via_api,
    span_names_for_incident,
)

ALIAS = "inc-sec-001"
SYSTEM_ID = "sys-agt-phish-008"
CANONICAL = "inc_sys-agt-phish-008_tool_scope_violation_001"


def test_phish_tool_scope_violation_e2e(client, db_session):
    reset_simulator(client)
    run_scenario_via_api(client, "tool_scope_violation", SYSTEM_ID)
    db_session.expire_all()

    assert db_session.query(Incident).count() == 1
    inc = incident_by_alias(db_session, ALIAS)
    assert inc.id == CANONICAL
    assert inc.signal_type == "tool_scope_violation"
    assert inc.classification_category == "Cyber"
    assert inc.severity == "critical"
    assert inc.responder_team == "Security Operations"
    assert inc.lifecycle == "Action Approval"

    governed = governed_span_names(db_session, inc.id)
    assert any(name in governed for name in ("quarantine.route", "route.select", "tool.route"))

    span_names = span_names_for_incident(db_session, inc.id)
    assert any(name in span_names for name in ("quarantine.route", "route.select"))
    assert "policy.evaluate" in span_names or "classify.threat" in span_names

    tool_norms = [
        n
        for n in db_session.query(NormalizedEvent).filter(NormalizedEvent.incident_id == inc.id)
        if (n.evaluation_signals or {}).get("span_name") in ("quarantine.route", "route.select", "tool.route")
        or n.operation_type == "tool_call"
    ]
    assert tool_norms
    assert any(
        float((n.evaluation_signals or {}).get("tool_scope_violation", 0)) >= 1.0
        or n.policy_result == "deny"
        for n in tool_norms
    )

    assert_owner_queue_contains(client, "Security Operations", ALIAS)
    evidence = assert_evidence_api(client, ALIAS, CANONICAL)
    summaries = " ".join(item["summary"] for item in evidence["items"])
    assert "quarantine.route" in summaries or "tool_call" in summaries
