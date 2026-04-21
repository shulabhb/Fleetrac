from fastapi import APIRouter, HTTPException

from app.services.incident_service import get_incident, list_incidents
from app.services.audit_log_service import list_audit_logs
from app.services.telemetry_service import latest_event_for_system

router = APIRouter()


@router.get("/incidents")
def get_incidents():
    return {"items": list_incidents()}


@router.get("/incidents/{incident_id}")
def get_incident_detail(incident_id: str):
    incident = get_incident(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    telemetry = latest_event_for_system(incident.system_id)
    audit_entries = [
        item
        for item in list_audit_logs()
        if item.target_id == incident.id or item.target_id == (telemetry.id if telemetry else "")
    ][:10]
    return {"incident": incident, "telemetry_context": telemetry, "audit_entries": audit_entries}
