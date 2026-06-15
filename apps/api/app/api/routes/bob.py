from fastapi import APIRouter, HTTPException, Response

from app.api.routes.bob_deprecation import apply_bob_deprecation
from app.services.bob_service import (
    get_investigation,
    get_investigation_for_target,
    list_investigations,
    list_recommendations,
)

router = APIRouter()


@router.get("/bob/investigations")
def get_investigations(
    response: Response,
    status: str | None = None,
    target_type: str | None = None,
    target_id: str | None = None,
):
    apply_bob_deprecation(response)
    return {
        "items": list_investigations(
            status=status, target_type=target_type, target_id=target_id
        ),
        "deprecated": True,
        "successor": "/api/v1/governance/evidence/{incident_id}",
    }


@router.get("/bob/investigations/{investigation_id}")
def get_investigation_detail(investigation_id: str, response: Response):
    apply_bob_deprecation(response)
    investigation = get_investigation(investigation_id)
    if not investigation:
        raise HTTPException(status_code=404, detail="Investigation not found")
    return {"item": investigation, "deprecated": True}


@router.get("/bob/investigations/for/{target_type}/{target_id}")
def get_investigation_for(target_type: str, target_id: str, response: Response):
    apply_bob_deprecation(response)
    investigation = get_investigation_for_target(target_type, target_id)
    return {"item": investigation, "deprecated": True}


@router.get("/bob/recommendations")
def get_recommendations(
    response: Response,
    status: str | None = None,
    target_type: str | None = None,
    target_id: str | None = None,
):
    apply_bob_deprecation(response)
    return {
        "items": list_recommendations(
            status=status, target_type=target_type, target_id=target_id
        ),
        "deprecated": True,
        "successor": "/api/v1/governance/evidence/{incident_id}",
    }
