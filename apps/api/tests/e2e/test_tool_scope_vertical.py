"""Tool scope violation scenario E2E."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.db.models import Incident
from app.db.session import get_session_factory
from app.simulator.http_ingest_client import post_ingest_sequence
from app.simulator.scenarios.tool_scope_violation import tool_scope_violation_sequence


@pytest.mark.asyncio
async def test_tool_scope_violation_creates_secops_incident(client, app):
    assert client.post("/api/v1/simulator/reset").status_code == 200
    transport = ASGITransport(app=app)
    envelopes = tool_scope_violation_sequence("sys-agt-cs-002")

    async with AsyncClient(transport=transport, base_url="http://test") as http_client:
        results = await post_ingest_sequence(envelopes, client=http_client, base_url="http://test")
    assert all(r.ok for r in results)

    factory = get_session_factory()
    db = factory()
    try:
        inc = db.query(Incident).filter(Incident.alias_id == "inc-sec-001").one_or_none()
        if inc is None:
            inc = db.query(Incident).filter(Incident.signal_type == "tool_scope_violation").first()
        assert inc is not None
        assert inc.owner_team == "Security Operations"
        assert inc.lifecycle == "Action Approval"
    finally:
        db.close()
