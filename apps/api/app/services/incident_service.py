from app.sample_data.mock_data import MOCK_STORE


def list_incidents():
    return MOCK_STORE["incidents"]


def get_incident(incident_id: str):
    return next((item for item in MOCK_STORE["incidents"] if item.id == incident_id), None)
