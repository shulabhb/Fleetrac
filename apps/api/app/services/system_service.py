from app.sample_data.mock_data import MOCK_STORE


def list_systems():
    return MOCK_STORE["systems"]


def get_system(system_id: str):
    return next((item for item in MOCK_STORE["systems"] if item.id == system_id), None)
