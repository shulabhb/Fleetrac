"""Local demo reset clears runtime rows and keeps the fleet registry."""

from app.db.models import Incident, System
from app.fleet.registry import FLEET_SYSTEMS


def test_reset_demo_clears_runtime_and_keeps_registry(client, db_session):
    client.post(
        "/api/v1/simulator/pitch/treasury_unsupported_claim",
    )
    assert db_session.query(Incident).count() >= 1

    response = client.post("/api/v1/simulator/reset-demo")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "reset"
    assert "system_registry" in body["preserved"]
    assert "telemetry" in body["cleared"]

    db_session.expire_all()
    assert db_session.query(Incident).count() == 0
    assert db_session.query(System).count() == len(FLEET_SYSTEMS)
