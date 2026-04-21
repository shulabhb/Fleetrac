from app.sample_data.mock_data import MOCK_STORE


def list_telemetry_events(system_id: str | None = None, limit: int = 200):
    events = MOCK_STORE["telemetry_events"]
    if system_id:
        events = [item for item in events if item.system_id == system_id]
    return events[:limit]


def latest_event_for_system(system_id: str):
    events = [item for item in MOCK_STORE["telemetry_events"] if item.system_id == system_id]
    return events[0] if events else None
