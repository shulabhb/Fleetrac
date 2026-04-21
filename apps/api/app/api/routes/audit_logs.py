from fastapi import APIRouter

from app.services.audit_log_service import list_audit_logs

router = APIRouter()


@router.get("/audit-logs")
def get_audit_logs():
    return {"items": list_audit_logs()}
