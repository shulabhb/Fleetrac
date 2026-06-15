from __future__ import annotations

from sqlalchemy.orm import Session

from app.db.models import (
    Assignment,
    EvidenceItem,
    EvidenceRecord,
    FleetracAnalysisRow,
    GovernedActionRow,
    Incident,
    NormalizedEvent,
    Notification,
    RawEvent,
    System,
    VerificationOutcomeRow,
)
from app.schemas.analysis import FleetracAnalysis
from app.fleet.registry import SYSTEM_BY_ID
from app.fleet.system_metadata import SYSTEM_METADATA
from app.schemas.governance import (
    EvidenceItemDTO,
    EvidenceRecordDTO,
    IngestLogNormalizedDTO,
    IngestLogResponse,
    IngestLogRow,
    LiveSignalRow,
    LiveSignalsResponse,
    OwnerQueueResponse,
    OwnerQueueRow,
)


def _resolve_incident(db: Session, incident_id: str) -> Incident | None:
    inc = db.get(Incident, incident_id)
    if inc:
        return inc
    return db.query(Incident).filter(Incident.alias_id == incident_id).one_or_none()


def _system_identity(system: System | None, system_id: str) -> dict:
    if system is None:
        return {
            "display_system_id": system_id,
            "system_name": system_id,
            "system_name_alias": None,
        }
    return {
        "display_system_id": system.display_id,
        "system_name": system.name,
        "system_name_alias": system.name_alias,
    }


def live_signals(
    db: Session,
    *,
    limit: int = 50,
    system_id: str | None = None,
    severity: str | None = None,
) -> LiveSignalsResponse:
    q = db.query(NormalizedEvent).order_by(NormalizedEvent.timestamp.desc())
    if system_id:
        q = q.filter(NormalizedEvent.system_id == system_id)
    if severity:
        q = q.filter(NormalizedEvent.severity == severity)
    rows = q.limit(limit).all()
    items: list[LiveSignalRow] = []
    for row in rows:
        system = db.get(System, row.system_id)
        ident = _system_identity(system, row.system_id)
        incident_alias_id = None
        if row.incident_id:
            inc = db.get(Incident, row.incident_id)
            incident_alias_id = inc.alias_id if inc else None
        items.append(
            LiveSignalRow(
                id=row.event_id,
                alias_id=incident_alias_id,
                system_id=row.system_id,
                event_id=row.event_id,
                timestamp=row.timestamp,
                operation_type=row.operation_type,
                signal_state=row.signal_state or "healthy",
                normalized_signal_type=row.normalized_signal_type,
                severity=row.severity,
                confidence=row.confidence,
                incident_id=row.incident_id,
                trace_id=row.trace_id,
                accountable_owner_team=row.accountable_owner_team
                or (system.owner_team if system else None),
                owner_team=row.accountable_owner_team or (system.owner_team if system else None),
                source_type=row.source_type,
                source_provider=row.source_provider,
                model=row.model,
                **ident,
            )
        )
    return LiveSignalsResponse(items=items, total=len(items))


def ingest_log(
    db: Session,
    *,
    limit: int = 50,
    system_id: str | None = None,
) -> IngestLogResponse:
    q = db.query(RawEvent).order_by(RawEvent.ingested_at.desc())
    if system_id:
        q = q.filter(RawEvent.system_id == system_id)
    rows = q.limit(limit).all()
    items: list[IngestLogRow] = []
    for raw in rows:
        system = db.get(System, raw.system_id)
        ident = _system_identity(system, raw.system_id)
        payload = raw.payload or {}
        source_type = str(payload.get("source_type", "unknown"))
        norm = (
            db.query(NormalizedEvent)
            .filter(NormalizedEvent.raw_payload_reference == raw.id)
            .order_by(NormalizedEvent.created_at.desc())
            .first()
        )
        normalized = None
        if norm:
            normalized = IngestLogNormalizedDTO(
                event_id=norm.event_id,
                timestamp=norm.timestamp,
                source_provider=norm.source_provider,
                source_type=norm.source_type,
                operation_type=norm.operation_type,
                model=norm.model,
                severity=norm.severity,
                normalized_signal_type=norm.normalized_signal_type,
                incident_id=norm.incident_id,
                evaluation_signals=norm.evaluation_signals or {},
            )
        items.append(
            IngestLogRow(
                raw_event_id=raw.id,
                ingested_at=raw.ingested_at,
                system_id=raw.system_id,
                display_system_id=ident["display_system_id"],
                system_name=ident["system_name_alias"] or ident["system_name"],
                idempotency_key=raw.idempotency_key,
                payload_hash=raw.payload_hash,
                source_type=source_type,
                raw_payload=payload,
                normalized=normalized,
            )
        )
    return IngestLogResponse(items=items, total=len(items))


def owner_queue(db: Session, *, owner_team: str) -> OwnerQueueResponse:
    rows = (
        db.query(Incident)
        .filter(Incident.responder_team == owner_team)
        .order_by(Incident.updated_at.desc())
        .all()
    )
    items: list[OwnerQueueRow] = []
    for inc in rows:
        system = db.get(System, inc.system_id)
        ident = _system_identity(system, inc.system_id)
        assignment = (
            db.query(Assignment).filter(Assignment.incident_id == inc.id).order_by(Assignment.created_at.desc()).first()
        )
        items.append(
            OwnerQueueRow(
                id=inc.id,
                alias_id=inc.alias_id,
                system_id=inc.system_id,
                lifecycle=inc.lifecycle,
                classification_category=inc.classification_category,
                severity=inc.severity,
                priority=inc.priority,
                accountable_owner_team=inc.accountable_owner_team,
                responder_team=inc.responder_team,
                owner_team=inc.responder_team,
                title=inc.title,
                summary=inc.summary,
                reviewer=assignment.reviewer_name if assignment else None,
                opened_at=inc.opened_at,
                updated_at=inc.updated_at,
                **ident,
            )
        )
    return OwnerQueueResponse(items=items, total=len(items))


def evidence_for_incident(db: Session, incident_id: str) -> EvidenceRecordDTO | None:
    inc = _resolve_incident(db, incident_id)
    if inc is None:
        return None
    system = db.get(System, inc.system_id)
    ident = _system_identity(system, inc.system_id)
    record = db.query(EvidenceRecord).filter(EvidenceRecord.incident_id == inc.id).one_or_none()
    if record is None:
        return None
    analysis_row = db.query(FleetracAnalysisRow).filter(FleetracAnalysisRow.incident_id == inc.id).one_or_none()
    items = (
        db.query(EvidenceItem)
        .filter(EvidenceItem.evidence_record_id == record.id)
        .order_by(EvidenceItem.created_at.asc())
        .all()
    )
    template = analysis_row.template if analysis_row else {}
    analysis = FleetracAnalysis.model_validate(template)
    analysis.alias_id = inc.alias_id
    assignment = (
        db.query(Assignment).filter(Assignment.incident_id == inc.id).order_by(Assignment.created_at.desc()).first()
    )
    return EvidenceRecordDTO(
        id=record.id,
        alias_id=inc.alias_id,
        system_id=inc.system_id,
        incident_id=inc.id,
        status=record.status,
        packaged_at=record.packaged_at,
        owner_team=inc.owner_team,
        title=inc.title,
        severity=inc.severity,
        lifecycle=inc.lifecycle,
        classification_category=inc.classification_category,
        reviewer=assignment.reviewer_name if assignment else None,
        items=[
            EvidenceItemDTO(
                id=i.id,
                kind=i.kind,
                reference_id=i.reference_id,
                summary=i.summary,
                created_at=i.created_at,
            )
            for i in items
        ],
        fleetrac_analysis=analysis,
        lifecycle_history=list(inc.lifecycle_history or []),
        **ident,
    )


def dashboard_summary(db: Session) -> dict:
    open_incidents = db.query(Incident).filter(Incident.lifecycle != "Closed").count()
    critical = (
        db.query(Incident)
        .filter(Incident.severity == "critical", Incident.lifecycle != "Closed")
        .count()
    )
    decisions = (
        db.query(Incident)
        .filter(Incident.lifecycle.in_(["Owner Review", "Action Approval"]))
        .count()
    )
    verification = (
        db.query(GovernedActionRow)
        .filter(GovernedActionRow.verification_status != "Not started")
        .count()
    )
    awaiting_approval = (
        db.query(GovernedActionRow)
        .filter(GovernedActionRow.status == "Awaiting approval")
        .count()
    )
    verification_improved = (
        db.query(VerificationOutcomeRow)
        .filter(VerificationOutcomeRow.outcome == "improvement_observed")
        .count()
    )
    verification_follow_up = (
        db.query(VerificationOutcomeRow)
        .filter(
            VerificationOutcomeRow.outcome.in_(
                ["no_material_change", "regression_detected"]
            )
        )
        .count()
    )
    verification_rollback = (
        db.query(VerificationOutcomeRow)
        .filter(VerificationOutcomeRow.outcome == "rollback_candidate")
        .count()
    )
    by_owner: dict[str, int] = {}
    for inc in db.query(Incident).filter(Incident.lifecycle != "Closed").all():
        by_owner[inc.owner_team] = by_owner.get(inc.owner_team, 0) + 1
    return {
        "active_incidents": open_incidents,
        "critical_incidents": critical,
        "decisions_needed": decisions,
        "verification_count": verification,
        "actions_awaiting_approval": awaiting_approval,
        "verification_improved": verification_improved,
        "verification_follow_up": verification_follow_up,
        "verification_rollback": verification_rollback,
        "owner_open_counts": by_owner,
    }


def evidence_library(db: Session, *, owner_team: str | None = None) -> dict:
    q = db.query(Incident).order_by(Incident.updated_at.desc())
    if owner_team:
        q = q.filter(Incident.owner_team == owner_team)
    incidents = q.all()
    records = []
    for inc in incidents:
        system = db.get(System, inc.system_id)
        ident = _system_identity(system, inc.system_id)
        item_count = (
            db.query(EvidenceItem)
            .join(EvidenceRecord, EvidenceItem.evidence_record_id == EvidenceRecord.id)
            .filter(EvidenceRecord.incident_id == inc.id)
            .count()
        )
        records.append(
            {
                "incident_id": inc.id,
                "alias_id": inc.alias_id,
                "title": inc.title,
                "lifecycle": inc.lifecycle,
                "owner_team": inc.owner_team,
                "evidence_items_count": item_count,
                **ident,
            }
        )
    return {"items": records, "total": len(records)}


def governance_systems(db: Session) -> dict:
    items: list[dict] = []
    for system in db.query(System).order_by(System.display_id).all():
        meta = SYSTEM_METADATA.get(system.id, {})
        open_count = (
            db.query(Incident)
            .filter(Incident.system_id == system.id, Incident.lifecycle != "Closed")
            .count()
        )
        last = (
            db.query(NormalizedEvent)
            .filter(NormalizedEvent.system_id == system.id)
            .order_by(NormalizedEvent.timestamp.desc())
            .first()
        )
        fleet = SYSTEM_BY_ID.get(system.id)
        items.append(
            {
                "system_id": system.id,
                "display_system_id": system.display_id,
                "system_name": system.name,
                "system_name_alias": system.name_alias,
                "owner_team": system.owner_team,
                "platform": fleet.platform if fleet else meta.get("cloud_provider", ""),
                "archetype": meta.get("archetype", "decision"),
                "open_incidents": open_count,
                "last_signal_at": last.timestamp.isoformat() if last else None,
            }
        )
    return {"items": items, "total": len(items)}


def list_notifications(db: Session, *, limit: int = 50) -> list[dict]:
    rows = db.query(Notification).order_by(Notification.created_at.desc()).limit(limit).all()
    return [
        {
            "id": n.id,
            "incident_id": n.incident_id,
            "channel": n.channel,
            "recipient": n.recipient,
            "status": n.status,
            "message": n.message,
            "created_at": n.created_at.isoformat(),
        }
        for n in rows
    ]
