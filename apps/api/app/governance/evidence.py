from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.db.models import EvidenceItem, EvidenceRecord, FleetracAnalysisRow
from app.governance.analysis import build_analysis_template


def ensure_evidence_for_incident(
    db: Session,
    *,
    incident_id: str,
    normalized_event_id: str,
    raw_event_id: str,
    metric_value: float,
    summary: str,
    signal_type: str = "unsupported_claim_elevated",
    system_id: str | None = None,
) -> EvidenceRecord:
    record = db.query(EvidenceRecord).filter(EvidenceRecord.incident_id == incident_id).one_or_none()
    if record is None:
        record = EvidenceRecord(
            id=str(uuid.uuid4()),
            incident_id=incident_id,
            status="Packaged",
        )
        db.add(record)
        db.flush()

        template = build_analysis_template(
            incident_id,
            system_id=system_id or "",
            signal_type=signal_type,
            metric_value=metric_value,
        )
        db.add(
            FleetracAnalysisRow(
                id=str(uuid.uuid4()),
                incident_id=incident_id,
                template=template,
            )
        )
        db.flush()

    existing = (
        db.query(EvidenceItem)
        .filter(
            EvidenceItem.evidence_record_id == record.id,
            EvidenceItem.reference_id == normalized_event_id,
        )
        .one_or_none()
    )
    if existing is None:
        db.add(
            EvidenceItem(
                id=str(uuid.uuid4()),
                evidence_record_id=record.id,
                kind="normalized_event",
                reference_id=normalized_event_id,
                summary=summary,
            )
        )
    raw_existing = (
        db.query(EvidenceItem)
        .filter(
            EvidenceItem.evidence_record_id == record.id,
            EvidenceItem.kind == "raw_event",
            EvidenceItem.reference_id == raw_event_id,
        )
        .one_or_none()
    )
    if raw_existing is None:
        db.add(
            EvidenceItem(
                id=str(uuid.uuid4()),
                evidence_record_id=record.id,
                kind="raw_event",
                reference_id=raw_event_id,
                summary=f"Raw OTEL envelope reference for {incident_id}",
            )
        )
    return record


def append_cluster_evidence(
    db: Session,
    *,
    incident_id: str,
    candidate,
    assessment,
) -> None:
    record = db.query(EvidenceRecord).filter(EvidenceRecord.incident_id == incident_id).one_or_none()
    if record is None:
        return

    role = candidate.evidence_role
    span = candidate.source_span_name or "span"
    summary = f"[{role}] {span} signal={candidate.signal_type} trace={candidate.trace_id}"

    existing = (
        db.query(EvidenceItem)
        .filter(
            EvidenceItem.evidence_record_id == record.id,
            EvidenceItem.reference_id == candidate.event_id,
        )
        .one_or_none()
    )
    if existing is not None:
        return

    db.add(
        EvidenceItem(
            id=str(uuid.uuid4()),
            evidence_record_id=record.id,
            kind=f"correlation_{role}",
            reference_id=candidate.event_id,
            summary=summary,
        )
    )


def append_recurrence_evidence(
    db: Session,
    *,
    incident_id: str,
    normalized_event_id: str,
    summary: str,
) -> None:
    record = db.query(EvidenceRecord).filter(EvidenceRecord.incident_id == incident_id).one_or_none()
    if record is None:
        ensure_evidence_for_incident(
            db,
            incident_id=incident_id,
            normalized_event_id=normalized_event_id,
            raw_event_id=normalized_event_id,
            metric_value=0.04,
            summary=summary,
            signal_type="unsupported_claim_elevated",
        )
        return
    db.add(
        EvidenceItem(
            id=str(uuid.uuid4()),
            evidence_record_id=record.id,
            kind="recurrence",
            reference_id=normalized_event_id,
            summary=summary,
        )
    )


def append_verification_evidence(
    db: Session,
    *,
    incident_id: str,
    outcome: str,
    summary: str,
) -> None:
    record = db.query(EvidenceRecord).filter(EvidenceRecord.incident_id == incident_id).one_or_none()
    if record is None:
        return
    db.add(
        EvidenceItem(
            id=str(uuid.uuid4()),
            evidence_record_id=record.id,
            kind="verification_result",
            reference_id=outcome,
            summary=summary,
        )
    )
    record.status = "Closed" if outcome == "improvement_observed" else record.status
