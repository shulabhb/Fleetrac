from fastapi import APIRouter

from app.rules.engine import evaluate_event
from app.schemas.entities import TelemetryEvent
from app.services.telemetry_service import list_telemetry_events

router = APIRouter()


@router.post("/telemetry/ingest")
def ingest_telemetry(event: TelemetryEvent):
    matched_rules = evaluate_event(event)
    return {
        "message": "Telemetry event accepted (mock).",
        "event_id": event.id,
        "matched_rules": matched_rules,
    }


@router.get("/telemetry/events")
def get_telemetry_events(system_id: str | None = None, limit: int = 200):
    return {"items": list_telemetry_events(system_id=system_id, limit=limit)}
