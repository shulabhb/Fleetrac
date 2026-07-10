from __future__ import annotations

from collections import defaultdict
from datetime import datetime

from sqlalchemy.orm import Session

from app.db.models import (
    Assignment,
    DetectionRule,
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


def _norm_to_ingest_dto(norm: NormalizedEvent) -> IngestLogNormalizedDTO:
    return IngestLogNormalizedDTO(
        event_id=norm.event_id,
        timestamp=norm.timestamp,
        source_provider=norm.source_provider,
        source_type=norm.source_type,
        operation_type=norm.operation_type,
        model=norm.model,
        severity=norm.severity,
        normalized_signal_type=norm.normalized_signal_type,
        incident_id=norm.incident_id,
        trace_id=norm.trace_id,
        span_id=norm.span_id,
        latency_ms=norm.latency_ms,
        evaluation_signals=norm.evaluation_signals or {},
    )


def _parent_span_id(norm: NormalizedEvent) -> str | None:
    ev = norm.evaluation_signals or {}
    val = ev.get("parent_span_id")
    return str(val) if val else None


def _live_signal_row(db: Session, row: NormalizedEvent) -> LiveSignalRow:
    system = db.get(System, row.system_id)
    ident = _system_identity(system, row.system_id)
    incident_alias_id = None
    if row.incident_id:
        inc = db.get(Incident, row.incident_id)
        incident_alias_id = inc.alias_id if inc else None
    return LiveSignalRow(
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
        span_id=row.span_id,
        parent_span_id=_parent_span_id(row),
        latency_ms=row.latency_ms,
        evaluation_signals=row.evaluation_signals or {},
        accountable_owner_team=row.accountable_owner_team or (system.owner_team if system else None),
        owner_team=row.accountable_owner_team or (system.owner_team if system else None),
        source_type=row.source_type,
        source_provider=row.source_provider,
        model=row.model,
        **ident,
    )


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
    items = [_live_signal_row(db, row) for row in rows]
    return LiveSignalsResponse(items=items, total=len(items))


def ingest_log(
    db: Session,
    *,
    limit: int = 50,
    system_id: str | None = None,
    since: datetime | None = None,
) -> IngestLogResponse:
    q = db.query(RawEvent).order_by(RawEvent.ingested_at.desc())
    if system_id:
        q = q.filter(RawEvent.system_id == system_id)
    if since is not None:
        q = q.filter(RawEvent.ingested_at > since)
    rows = q.limit(limit).all()
    if not rows:
        return IngestLogResponse(items=[], total=0)

    raw_ids = [raw.id for raw in rows]
    system_ids = {raw.system_id for raw in rows}
    systems = {
        system.id: system
        for system in db.query(System).filter(System.id.in_(system_ids)).all()
    }
    norm_rows = (
        db.query(NormalizedEvent)
        .filter(NormalizedEvent.raw_payload_reference.in_(raw_ids))
        .order_by(NormalizedEvent.created_at.asc())
        .all()
    )
    norm_by_raw: dict[str, list[NormalizedEvent]] = defaultdict(list)
    for norm in norm_rows:
        norm_by_raw[norm.raw_payload_reference].append(norm)

    items: list[IngestLogRow] = []
    for raw in rows:
        ident = _system_identity(systems.get(raw.system_id), raw.system_id)
        payload = raw.payload or {}
        source_type = str(payload.get("source_type", "unknown"))
        normalized_spans = [_norm_to_ingest_dto(n) for n in norm_by_raw.get(raw.id, [])]
        normalized = normalized_spans[0] if normalized_spans else None
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
                normalized_spans=normalized_spans,
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
                diagnosis_family=inc.diagnosis_family,
                severity_reason=inc.severity_reason,
                assessment_confidence=inc.assessment_confidence,
                occurrence_count=inc.occurrence_count,
                trace_count=inc.trace_count,
                highest_severity=inc.highest_severity,
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

    def _evidence_item_dto(i: EvidenceItem) -> EvidenceItemDTO:
        trace_id = None
        span_id = None
        operation_type = None
        evaluation_signals: dict = {}
        if i.kind == "normalized_event":
            norm = db.query(NormalizedEvent).filter(NormalizedEvent.event_id == i.reference_id).one_or_none()
            if norm:
                trace_id = norm.trace_id
                span_id = norm.span_id
                operation_type = norm.operation_type
                evaluation_signals = norm.evaluation_signals or {}
        return EvidenceItemDTO(
            id=i.id,
            kind=i.kind,
            reference_id=i.reference_id,
            summary=i.summary,
            created_at=i.created_at,
            trace_id=trace_id,
            span_id=span_id,
            operation_type=operation_type,
            evaluation_signals=evaluation_signals,
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
        items=[_evidence_item_dto(i) for i in items],
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


def governance_system_detail(db: Session, system_id: str) -> dict | None:
    system = db.get(System, system_id)
    if system is None:
        return None
    meta = SYSTEM_METADATA.get(system.id, {})
    fleet = SYSTEM_BY_ID.get(system.id)
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
    return {
        "system_id": system.id,
        "display_system_id": system.display_id,
        "system_name": system.name,
        "system_name_alias": system.name_alias,
        "owner_team": system.owner_team,
        "team_lead": system.team_lead,
        "default_reviewer": system.default_reviewer,
        "platform": fleet.platform if fleet else meta.get("cloud_provider", ""),
        "archetype": meta.get("archetype", "decision"),
        "description": meta.get("description", ""),
        "business_function": meta.get("business_function", ""),
        "data_sensitivity": meta.get("data_sensitivity", ""),
        "cloud_provider": meta.get("cloud_provider", ""),
        "cloud_region": meta.get("cloud_region", ""),
        "approved_model_name": meta.get("approved_model_name", ""),
        "approved_tools": list(meta.get("approved_tools") or ()),
        "blocked_tools": list(meta.get("blocked_tools") or ()),
        "baseline_metrics": system.baseline_metrics or {},
        "applicable_control_ids": system.applicable_control_ids or [],
        "open_incidents": open_count,
        "last_signal_at": last.timestamp.isoformat() if last else None,
    }


def system_incidents(db: Session, system_id: str) -> dict:
    rows = (
        db.query(Incident)
        .filter(Incident.system_id == system_id)
        .order_by(Incident.updated_at.desc())
        .all()
    )
    items = []
    for inc in rows:
        system = db.get(System, inc.system_id)
        ident = _system_identity(system, inc.system_id)
        items.append(
            {
                "id": inc.id,
                "alias_id": inc.alias_id,
                "system_id": inc.system_id,
                "lifecycle": inc.lifecycle,
                "severity": inc.severity,
                "priority": inc.priority,
                "title": inc.title,
                "summary": inc.summary,
                "signal_type": inc.signal_type,
                "opened_at": inc.opened_at.isoformat(),
                "updated_at": inc.updated_at.isoformat(),
                **ident,
            }
        )
    return {"items": items, "total": len(items)}


def system_telemetry(db: Session, system_id: str, *, limit: int = 120) -> dict:
    rows = (
        db.query(NormalizedEvent)
        .filter(NormalizedEvent.system_id == system_id)
        .order_by(NormalizedEvent.timestamp.asc())
        .limit(limit)
        .all()
    )
    points = []
    for row in rows:
        ev = row.evaluation_signals or {}
        points.append(
            {
                "timestamp": row.timestamp.isoformat(),
                "latency_ms": row.latency_ms or ev.get("latency_ms"),
                "grounding_score": ev.get("grounding_score"),
                "unsupported_claim_rate": ev.get("unsupported_claim_rate"),
                "signal_type": row.normalized_signal_type,
                "severity": row.severity,
            }
        )
    return {"items": points, "total": len(points)}


def system_controls(db: Session, system_id: str) -> dict:
    system = db.get(System, system_id)
    if system is None:
        return {"items": [], "total": 0}
    control_ids = set(system.applicable_control_ids or [])
    rules = db.query(DetectionRule).filter(DetectionRule.id.in_(control_ids)).all() if control_ids else []
    items = []
    for rule in rules:
        last_norm = (
            db.query(NormalizedEvent)
            .filter(
                NormalizedEvent.system_id == system_id,
                NormalizedEvent.normalized_signal_type == rule.signal_type,
            )
            .order_by(NormalizedEvent.timestamp.desc())
            .first()
        )
        open_inc = (
            db.query(Incident)
            .filter(
                Incident.system_id == system_id,
                Incident.rule_id == rule.id,
                Incident.lifecycle != "Closed",
            )
            .order_by(Incident.updated_at.desc())
            .first()
        )
        items.append(
            {
                "rule_id": rule.id,
                "signal_type": rule.signal_type,
                "threshold_field": rule.threshold_field,
                "threshold_value": rule.threshold_value,
                "severity": rule.severity,
                "last_fired_at": last_norm.timestamp.isoformat() if last_norm else None,
                "open_incident_id": open_inc.alias_id or open_inc.id if open_inc else None,
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
