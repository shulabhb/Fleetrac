from __future__ import annotations

import pytest
from httpx import ASGITransport

from app.api.routes.simulator import run_scenario_with_transport
from app.db.session import get_session_factory
from app.simulator.system_profiles import normalized_model_name, profile_for
from app.slice_a.constants import SYSTEM_ID


def test_treasury_profile_matches_registry_model():
    profile = profile_for(SYSTEM_ID)
    assert profile.model_code == "M40"
    assert profile.use_case == "NII sensitivity"
    assert normalized_model_name(SYSTEM_ID) == "M40 · NII sensitivity"


@pytest.mark.asyncio
async def test_normalizer_uses_registry_model_label(client, app):
    assert client.post("/api/v1/simulator/reset").status_code == 200
    transport = ASGITransport(app=app)
    factory = get_session_factory()
    db = factory()
    try:
        await run_scenario_with_transport(transport, db=db)
    finally:
        db.close()

    signals = client.get("/api/v1/governance/live-signals").json()
    assert signals["total"] >= 1
    assert any(row.get("model") == "M40 · NII sensitivity" for row in signals["items"])


def test_mock_store_fleet_only():
    from app.fleet.registry import FLEET_SYSTEMS
    from app.sample_data.mock_data import MOCK_STORE

    assert len(MOCK_STORE["systems"]) == len(FLEET_SYSTEMS)
    store_ids = {s.id for s in MOCK_STORE["systems"]}
    assert store_ids == {s.id for s in FLEET_SYSTEMS}
    treasury = next(s for s in MOCK_STORE["systems"] if s.id == "sys-agt-treasury-001")
    assert treasury.model == "M40"
    assert treasury.use_case == "NII sensitivity"
