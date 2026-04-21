from fastapi import APIRouter

from app.services.system_service import list_systems

router = APIRouter()


@router.get("/systems")
def get_systems():
    return {"items": list_systems()}
