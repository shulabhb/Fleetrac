from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.db.models import Incident
from app.detection.engine import DetectionMatch
from app.fleet.registry import SYSTEM_BY_ID, canonical_incident_id, incident_alias
from app.governance.evidence import append_recurrence_evidence, ensure_evidence_for_incident
from app.governance.notifications import record_notification_and_assignment
from app.schemas.fleetrac_event import FleetracEvent


def _history_entry(to_stage: str, *, note: str) -> dict:
    return {
        "to": to_stage,
        "at": datetime.now(timezone.utc).isoformat(),
        "note": note,
    }


def _incident_title(system_name: str, signal_type: str) -> str:
    label = signal_type.replace("_", " ").title()
    return f"{label} — {system_name}"


def create_incident_from_detection(
    db: Session,
    *,
    event: FleetracEvent,
    match: DetectionMatch,
) -> Incident:
    system = SYSTEM_BY_ID.get(event.system_id)
    system_name = system.name if system else event.system_id
    canonical_id = canonical_incident_id(event.system_id, match.signal_type)
    alias_id = incident_alias(event.system_id, match.signal_type)

    summary = (
        f"{match.signal_type} detected: {match.metric_value:.4g} "
        f"vs threshold {match.threshold_value:.4g}."
    )
    history = [
        _history_entry("Packaged", note="Evidence packaged from ingest pipeline"),
        _history_entry(match.lifecycle_final, note="Routed to owner queue"),
    ]
    incident = Incident(
        id=canonical_id,
        alias_id=alias_id,
        system_id=event.system_id,
        correlation_key=event.correlation_key,
        rule_id=match.rule_id,
        signal_type=match.signal_type,
        classification_category=match.risk_category,
        severity=match.severity,
        priority=match.priority,
        lifecycle=match.lifecycle_final,
        owner_team=system.owner_team if system else "Model Risk Management",
        title=_incident_title(system_name, match.signal_type),
        summary=summary,
        lifecycle_history=history,
    )
    db.add(incident)
    db.flush()

    ensure_evidence_for_incident(
        db,
        incident_id=incident.id,
        normalized_event_id=event.event_id,
        raw_event_id=event.raw_payload_reference,
        metric_value=match.metric_value,
        summary="Threshold breach evaluation span",
        signal_type=match.signal_type,
        system_id=event.system_id,
    )
    record_notification_and_assignment(
        db,
        incident_id=incident.id,
        title=incident.title,
        owner_team=incident.owner_team,
    )
    return incident


def update_incident_recurrence(
    db: Session,
    *,
    incident: Incident,
    event: FleetracEvent,
    note: str,
) -> Incident:
    incident.summary = f"{incident.summary} | Recurrence observed on span {event.span_id}."
    incident.lifecycle_history = list(incident.lifecycle_history or []) + [
        _history_entry(incident.lifecycle, note=note),
    ]
    append_recurrence_evidence(
        db,
        incident_id=incident.id,
        normalized_event_id=event.event_id,
        summary=note,
    )
    return incident


def advance_lifecycle(db: Session, incident: Incident, to_stage: str, *, note: str) -> Incident:
    incident.lifecycle = to_stage
    incident.lifecycle_history = list(incident.lifecycle_history or []) + [
        _history_entry(to_stage, note=note),
    ]
    return incident
