from app.sample_data.action_data import ACTION_STORE
from app.sample_data.access_policy_data import POLICY_STORE


def list_actions(
    execution_status: str | None = None,
    approval_status: str | None = None,
    risk_level: str | None = None,
    source_type: str | None = None,
    source_id: str | None = None,
    target_system_id: str | None = None,
    related_incident_id: str | None = None,
    related_control_id: str | None = None,
    bob_investigation_id: str | None = None,
):
    items = ACTION_STORE["actions"]
    if execution_status:
        items = [a for a in items if a.execution_status == execution_status]
    if approval_status:
        items = [a for a in items if a.approval_status == approval_status]
    if risk_level:
        items = [a for a in items if a.risk_level == risk_level]
    if source_type:
        items = [a for a in items if a.source_type == source_type]
    if source_id:
        items = [a for a in items if a.source_id == source_id]
    if target_system_id:
        items = [a for a in items if a.target_system_id == target_system_id]
    if related_incident_id:
        items = [a for a in items if a.related_incident_id == related_incident_id]
    if related_control_id:
        items = [a for a in items if a.related_control_id == related_control_id]
    if bob_investigation_id:
        items = [a for a in items if a.bob_investigation_id == bob_investigation_id]
    return items


def get_action(action_id: str):
    return next((a for a in ACTION_STORE["actions"] if a.id == action_id), None)


def get_access_policy(system_id: str):
    return POLICY_STORE.get(system_id)


def list_access_policies():
    return list(POLICY_STORE.values())
