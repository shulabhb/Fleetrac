from fastapi import APIRouter

from app.services.rule_service import list_rules

router = APIRouter()


@router.get("/rules")
def get_rules():
    return {"items": list_rules()}
