from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.models import Incident
from app.db.session import get_db
from app.governance.actions import (
    approve_action,
    create_action_from_incident,
    get_action,
    list_actions,
    reject_action,
)
from app.governance.incidents import advance_lifecycle
from app.governance.read_models import (
    dashboard_summary,
    evidence_for_incident,
    evidence_library,
    governance_system_detail,
    governance_systems,
    ingest_log,
    list_notifications,
    live_signals,
    owner_queue,
    system_controls,
    system_incidents,
    system_telemetry,
)
from app.governance.verification import verify_action
from app.schemas.governance import (
    EvidenceRecordDTO,
    IngestLogResponse,
    LiveSignalsResponse,
    OwnerQueueResponse,
)

router = APIRouter(prefix="/governance", tags=["governance"])


class LifecycleRequest(BaseModel):
    stage: str
    note: str = ""


class CreateActionRequest(BaseModel):
    execution_mode: str = "approval_required"


class VerifyRequest(BaseModel):
    outcome: str
    summary: str = ""


@router.get("/live-signals", response_model=LiveSignalsResponse)
def get_live_signals(
    limit: int = Query(50, ge=1, le=200),
    system_id: str | None = None,
    severity: str | None = None,
    db: Session = Depends(get_db),
) -> LiveSignalsResponse:
    return live_signals(db, limit=limit, system_id=system_id, severity=severity)


@router.get("/ingest-log", response_model=IngestLogResponse)
def get_ingest_log(
    limit: int = Query(50, ge=1, le=200),
    system_id: str | None = None,
    since: datetime | None = None,
    db: Session = Depends(get_db),
) -> IngestLogResponse:
    return ingest_log(db, limit=limit, system_id=system_id, since=since)


@router.get("/systems")
def get_governance_systems(db: Session = Depends(get_db)) -> dict:
    return governance_systems(db)


@router.get("/systems/{system_id}")
def get_governance_system_detail(system_id: str, db: Session = Depends(get_db)) -> dict:
    detail = governance_system_detail(db, system_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="System not found")
    return detail


@router.get("/systems/{system_id}/incidents")
def get_system_incidents(system_id: str, db: Session = Depends(get_db)) -> dict:
    return system_incidents(db, system_id)


@router.get("/systems/{system_id}/signals", response_model=LiveSignalsResponse)
def get_system_signals(
    system_id: str,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> LiveSignalsResponse:
    return live_signals(db, limit=limit, system_id=system_id)


@router.get("/systems/{system_id}/telemetry")
def get_system_telemetry(
    system_id: str,
    limit: int = Query(120, ge=1, le=500),
    db: Session = Depends(get_db),
) -> dict:
    return system_telemetry(db, system_id, limit=limit)


@router.get("/systems/{system_id}/controls")
def get_system_controls(system_id: str, db: Session = Depends(get_db)) -> dict:
    return system_controls(db, system_id)


@router.get("/owner-queue", response_model=OwnerQueueResponse)
def get_owner_queue(
    owner_team: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
) -> OwnerQueueResponse:
    return owner_queue(db, owner_team=owner_team)


@router.get("/evidence/{incident_id}", response_model=EvidenceRecordDTO)
def get_evidence(incident_id: str, db: Session = Depends(get_db)) -> EvidenceRecordDTO:
    dto = evidence_for_incident(db, incident_id)
    if dto is None:
        raise HTTPException(status_code=404, detail="Evidence not found")
    return dto


@router.get("/evidence-library")
def get_evidence_library(
    owner_team: str | None = None,
    db: Session = Depends(get_db),
) -> dict:
    return evidence_library(db, owner_team=owner_team)


@router.get("/dashboard-summary")
def get_dashboard_summary(db: Session = Depends(get_db)) -> dict:
    return dashboard_summary(db)


@router.get("/notifications")
def get_notifications(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> dict:
    return {"items": list_notifications(db, limit=limit)}


@router.post("/incidents/{incident_id}/lifecycle")
def post_lifecycle(
    incident_id: str,
    body: LifecycleRequest,
    db: Session = Depends(get_db),
) -> dict:
    inc = db.query(Incident).filter(
        (Incident.id == incident_id) | (Incident.alias_id == incident_id)
    ).one_or_none()
    if inc is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    advance_lifecycle(db, inc, body.stage, note=body.note or f"Advanced to {body.stage}")
    db.commit()
    return {"incident_id": inc.id, "lifecycle": inc.lifecycle}


@router.post("/incidents/{incident_id}/actions")
def post_create_action(
    incident_id: str,
    body: CreateActionRequest,
    db: Session = Depends(get_db),
) -> dict:
    inc = db.query(Incident).filter(
        (Incident.id == incident_id) | (Incident.alias_id == incident_id)
    ).one_or_none()
    if inc is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    action = create_action_from_incident(db, inc, execution_mode=body.execution_mode)
    advance_lifecycle(db, inc, "Action Approval", note="Governed action created")
    db.commit()
    return {"action_id": action.id, "status": action.status}


@router.get("/actions")
def get_governed_actions(
    status: str | None = None,
    db: Session = Depends(get_db),
) -> dict:
    rows = list_actions(db, status=status)
    return {
        "items": [
            {
                "id": r.id,
                "incident_id": r.incident_id,
                "alias_id": r.alias_id,
                "title": r.title,
                "owner_team": r.owner_team,
                "system_name": r.system_name,
                "risk_category": r.risk_category,
                "severity": r.severity,
                "execution_mode": r.execution_mode,
                "status": r.status,
                "verification_status": r.verification_status,
                "recommended_action": r.recommended_action,
                "system_id": r.system_id,
                "assigned_to": r.assigned_to,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]
    }


@router.post("/actions/{action_id}/approve")
def post_approve_action(action_id: str, db: Session = Depends(get_db)) -> dict:
    action = get_action(db, action_id)
    if action is None:
        raise HTTPException(status_code=404, detail="Action not found")
    approve_action(db, action)
    db.commit()
    return {"action_id": action.id, "status": action.status}


@router.post("/actions/{action_id}/reject")
def post_reject_action(action_id: str, db: Session = Depends(get_db)) -> dict:
    action = get_action(db, action_id)
    if action is None:
        raise HTTPException(status_code=404, detail="Action not found")
    reject_action(db, action)
    db.commit()
    return {"action_id": action.id, "status": action.status}


@router.post("/actions/{action_id}/verify")
def post_verify_action(
    action_id: str,
    body: VerifyRequest,
    db: Session = Depends(get_db),
) -> dict:
    action = get_action(db, action_id)
    if action is None:
        raise HTTPException(status_code=404, detail="Action not found")
    row = verify_action(
        db,
        action=action,
        outcome=body.outcome,
        summary=body.summary or f"Verification outcome: {body.outcome}",
    )
    db.commit()
    return {"verification_id": row.id, "outcome": row.outcome}


@router.get("/incidents/{incident_id}/assessment")
def get_incident_assessment(incident_id: str, db: Session = Depends(get_db)) -> dict:
    from app.governance.correlation_read_models import incident_assessment

    result = incident_assessment(db, incident_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return result


@router.get("/incidents/{incident_id}/severity-history")
def get_incident_severity_history(incident_id: str, db: Session = Depends(get_db)) -> dict:
    from app.governance.correlation_read_models import incident_severity_history

    return incident_severity_history(db, incident_id)


@router.get("/correlation/clusters/{cluster_id}")
def get_correlation_cluster(cluster_id: str, db: Session = Depends(get_db)) -> dict:
    from app.governance.correlation_read_models import correlation_cluster

    result = correlation_cluster(db, cluster_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Cluster not found")
    return result
