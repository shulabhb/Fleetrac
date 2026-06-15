from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.routes.simulator import run_scenario_with_transport
from app.db.models import EvidenceItem, EvidenceRecord, FleetracAnalysisRow
from app.db.session import get_session_factory
from app.slice_a.constants import INCIDENT_CANONICAL_ID


@pytest.mark.asyncio
async def test_incident_creates_evidence_and_analysis(client, app):
    client.post("/api/v1/simulator/reset")
    transport = ASGITransport(app=app)
    factory = get_session_factory()
    db = factory()
    try:
        await run_scenario_with_transport(transport, db=db)
    finally:
        db.close()

    db = factory()
    try:
        record = db.query(EvidenceRecord).filter(EvidenceRecord.incident_id == INCIDENT_CANONICAL_ID).one()
        items = db.query(EvidenceItem).filter(EvidenceItem.evidence_record_id == record.id).all()
        analysis = db.query(FleetracAnalysisRow).filter(FleetracAnalysisRow.incident_id == INCIDENT_CANONICAL_ID).one()
        assert record.status == "Packaged"
        assert len(items) >= 1
        assert analysis.template.get("summary")
    finally:
        db.close()
