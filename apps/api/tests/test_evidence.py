from __future__ import annotations

from tests.e2e.helpers import reset_simulator, run_scenario_via_api
from app.db.models import EvidenceItem, EvidenceRecord, FleetracAnalysisRow
from app.slice_a.constants import INCIDENT_CANONICAL_ID, SYSTEM_ID


def test_incident_creates_evidence_and_analysis(client, db_session):
    reset_simulator(client)
    run_scenario_via_api(client, "unsupported_claim_spike", SYSTEM_ID)

    db_session.expire_all()
    record = db_session.query(EvidenceRecord).filter(EvidenceRecord.incident_id == INCIDENT_CANONICAL_ID).one()
    items = db_session.query(EvidenceItem).filter(EvidenceItem.evidence_record_id == record.id).all()
    analysis = db_session.query(FleetracAnalysisRow).filter(FleetracAnalysisRow.incident_id == INCIDENT_CANONICAL_ID).one()
    assert record.status == "Packaged"
    assert len(items) >= 1
    assert analysis.template.get("summary")
