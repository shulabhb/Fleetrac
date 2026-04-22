from fastapi import APIRouter, HTTPException

from app.services.action_service import (
    get_access_policy,
    get_action,
    list_access_policies,
    list_actions,
)


router = APIRouter()


@router.get("/actions")
def get_actions(
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
    return {
        "items": list_actions(
            execution_status=execution_status,
            approval_status=approval_status,
            risk_level=risk_level,
            source_type=source_type,
            source_id=source_id,
            target_system_id=target_system_id,
            related_incident_id=related_incident_id,
            related_control_id=related_control_id,
            bob_investigation_id=bob_investigation_id,
        )
    }


@router.get("/actions/{action_id}")
def get_action_detail(action_id: str):
    action = get_action(action_id)
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    return {"item": action}


@router.get("/access-policies")
def get_access_policies():
    return {"items": list_access_policies()}


@router.get("/access-policies/{system_id}")
def get_access_policy_for_system(system_id: str):
    policy = get_access_policy(system_id)
    if not policy:
        raise HTTPException(status_code=404, detail="Access policy not found")
    return {"item": policy}
