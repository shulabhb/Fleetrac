from fastapi import APIRouter, HTTPException, Query

from app.services.operations_service import (
    bob_impact_summary,
    get_change,
    get_change_by_action,
    get_operations,
    list_changes,
    list_connector_status,
    list_environments,
    list_execution_console,
    list_integrations,
    list_operations,
    list_operations_policies,
)

router = APIRouter()


# -------- Integrations --------


@router.get("/integrations")
def get_integrations():
    return {"items": list_integrations()}


# -------- Environments --------


@router.get("/environments")
def get_environments():
    return {"items": list_environments()}


# -------- Operations policies --------


@router.get("/operations-policies")
def get_operations_policies():
    return {"items": list_operations_policies()}


# -------- Connector / platform status --------


@router.get("/connector-status")
def get_connector_status():
    return {"items": list_connector_status()}


# -------- Execution Console --------


@router.get("/execution-console")
def get_execution_console(
    target_system_id: str | None = Query(default=None),
    action_id: str | None = Query(default=None),
    investigation_id: str | None = Query(default=None),
    integration_id: str | None = Query(default=None),
    limit: int | None = Query(default=None),
):
    return {
        "items": list_execution_console(
            target_system_id=target_system_id,
            action_id=action_id,
            investigation_id=investigation_id,
            integration_id=integration_id,
            limit=limit,
        )
    }


# -------- System operations --------


@router.get("/system-operations")
def get_system_operations_list():
    return {"items": list_operations()}


@router.get("/system-operations/{system_id}")
def get_system_operations(system_id: str):
    item = get_operations(system_id)
    if item is None:
        raise HTTPException(status_code=404, detail="System operations not found")
    return {"item": item}


# -------- Changes & Impact --------


@router.get("/changes")
def get_changes(
    target_system_id: str | None = Query(default=None),
    source_action_id: str | None = Query(default=None),
    source_investigation_id: str | None = Query(default=None),
    source_incident_id: str | None = Query(default=None),
    impact_status: str | None = Query(default=None),
    limit: int | None = Query(default=None),
):
    return {
        "items": list_changes(
            target_system_id=target_system_id,
            source_action_id=source_action_id,
            source_investigation_id=source_investigation_id,
            source_incident_id=source_incident_id,
            impact_status=impact_status,
            limit=limit,
        )
    }


@router.get("/changes/by-action/{action_id}")
def get_change_for_action(action_id: str):
    item = get_change_by_action(action_id)
    if item is None:
        raise HTTPException(status_code=404, detail="No change recorded for action")
    return {"item": item}


@router.get("/changes/{change_id}")
def get_change_detail(change_id: str):
    item = get_change(change_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Change not found")
    return {"item": item}


# -------- Bob Impact Summary --------


@router.get("/bob-impact-summary")
def get_bob_impact_summary():
    return {"item": bob_impact_summary()}
