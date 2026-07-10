"""Treasury unsupported-claim pitch scenario — full HTTP E2E."""

from __future__ import annotations

from app.db.models import Assignment, EvidenceItem, Incident, NormalizedEvent, Notification, RawEvent
from app.simulator.scenarios.platform import scenario_trace_bundle
from app.slice_a.constants import (
    INCIDENT_ALIAS_ID,
    INCIDENT_CANONICAL_ID,
    LIFECYCLE_FINAL,
    OWNER_TEAM,
    SYSTEM_ID,
)
from tests.e2e.helpers import (
    assert_evidence_api,
    assert_owner_queue_contains,
    governed_span_names,
    incident_by_alias,
    reset_simulator,
    run_scenario_via_api,
    span_names_for_incident,
)


def test_treasury_unsupported_claim_e2e(client, db_session):
    reset_simulator(client)
    run_scenario_via_api(client, "unsupported_claim_spike", SYSTEM_ID)
    db_session.expire_all()

    assert db_session.query(RawEvent).count() == 1
    assert db_session.query(NormalizedEvent).count() >= 7
    assert db_session.query(Incident).count() == 1

    inc = incident_by_alias(db_session, INCIDENT_ALIAS_ID)
    assert inc.id == INCIDENT_CANONICAL_ID
    assert inc.accountable_owner_team == OWNER_TEAM
    assert inc.responder_team == OWNER_TEAM
    assert inc.signal_type == "unsupported_claim_elevated"
    assert inc.classification_category == "Output Reliability"
    assert inc.severity == "critical"
    assert inc.lifecycle == LIFECYCLE_FINAL

    governed = governed_span_names(db_session, inc.id)
    assert "evaluate.unsupported_claims" in governed

    span_names = span_names_for_incident(db_session, inc.id)
    assert "evaluate.unsupported_claims" in span_names
    assert "evaluate.grounding" in span_names or "verify.citations" in span_names

    norms = (
        db_session.query(NormalizedEvent)
        .filter(NormalizedEvent.incident_id == inc.id)
        .all()
    )
    claim_norm = next(
        n for n in norms if (n.evaluation_signals or {}).get("span_name") == "evaluate.unsupported_claims"
    )
    assert claim_norm.operation_type == "output_evaluation"
    assert claim_norm.normalized_signal_type == "unsupported_claim_elevated"
    assert float(claim_norm.evaluation_signals.get("unsupported_claim_rate", 0)) > 0.03

    assert db_session.query(Notification).filter(Notification.incident_id == inc.id).count() >= 1
    assert db_session.query(Assignment).filter(Assignment.incident_id == inc.id).count() >= 1

    assert_owner_queue_contains(client, OWNER_TEAM, INCIDENT_ALIAS_ID)
    evidence = assert_evidence_api(client, INCIDENT_ALIAS_ID, INCIDENT_CANONICAL_ID)
    summaries = " ".join(item["summary"] for item in evidence["items"])
    assert "evaluate.unsupported_claims" in summaries or claim_norm.span_id in summaries

    signals = client.get("/api/v1/governance/live-signals", params={"system_id": SYSTEM_ID})
    assert signals.status_code == 200
    assert any(row.get("incident_id") == INCIDENT_CANONICAL_ID for row in signals.json()["items"])


def test_treasury_unsupported_claim_recurrence_correlates(client, db_session):
    reset_simulator(client)
    run_scenario_via_api(client, "unsupported_claim_spike", SYSTEM_ID)
    first_items = db_session.query(EvidenceItem).count()

    bundle2 = scenario_trace_bundle(SYSTEM_ID, "unsupported_claim_spike", seed=42, seq=1)
    resp = client.post("/api/v1/ingest/events", json=bundle2)
    assert resp.status_code == 200
    db_session.expire_all()

    assert db_session.query(Incident).count() == 1
    inc = incident_by_alias(db_session, INCIDENT_ALIAS_ID)
    assert inc.alias_id == INCIDENT_ALIAS_ID
    assert db_session.query(EvidenceItem).count() > first_items
    assert "Recurrence" in inc.summary or "recurrence" in inc.summary.lower()
