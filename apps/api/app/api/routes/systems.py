from fastapi import APIRouter, HTTPException

from app.services.system_service import get_system, list_systems

router = APIRouter()


@router.get("/systems")
def get_systems():
    return {"items": list_systems()}


@router.get("/systems/{system_id}")
def get_system_detail(system_id: str):
    item = get_system(system_id)
    if not item:
        raise HTTPException(status_code=404, detail="System not found")
    return {"item": item}
