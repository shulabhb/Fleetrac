from __future__ import annotations

import hashlib
import json
import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.db.models import DetectionRule, NormalizedEvent, RawEvent, System
from app.detection.correlator import find_active_incident
from app.detection.engine import evaluate_event
from app.governance.incidents import create_incident_from_detection, update_incident_recurrence
from app.pipeline.adapters.router import AdapterError, adapt_raw_envelope
from app.pipeline.normalizer import correlation_key_for, normalize_adapted
from app.schemas.fleetrac_event import FleetracEvent
from app.schemas.ingestion import IngestEventResponse, RawIngestEnvelope
from app.services.event_stream import broadcaster


def _payload_hash(payload: dict[str, Any]) -> str:
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(raw.encode()).hexdigest()
    return f"sha256:{digest}"


def _persist_normalized(db: Session, event: FleetracEvent) -> NormalizedEvent:
    row = NormalizedEvent(
        id=str(uuid.uuid4()),
        event_id=event.event_id,
        timestamp=event.timestamp,
        tenant_id=event.tenant_id,
        environment=event.environment,
        source_provider=event.source_provider,
        source_service=event.source_service,
        source_type=event.source_type,
        system_id=event.system_id,
        trace_id=event.trace_id,
        span_id=event.span_id,
        operation_type=event.operation_type,
        model=event.model,
        tool=event.tool,
        latency_ms=event.latency_ms,
        evaluation_signals=event.evaluation_signals,
        policy_result=event.policy_result,
        normalized_signal_type=event.normalized_signal_type,
        severity=event.severity,
        confidence=event.confidence,
        evidence_reference=event.evidence_reference,
        raw_payload_reference=event.raw_payload_reference,
        owner_team=event.owner_team,
        applicable_control_ids=event.applicable_control_ids,
        correlation_key=event.correlation_key,
        incident_id=event.incident_id,
        content_mode=event.content_mode,
        payload_hash=event.payload_hash,
    )
    db.add(row)
    return row


async def process_ingest_event(db: Session, payload: dict[str, Any]) -> IngestEventResponse:
    envelope = RawIngestEnvelope.model_validate(payload)
    idem = envelope.idempotency_key

    existing = db.query(RawEvent).filter(RawEvent.idempotency_key == idem).one_or_none()
    if existing:
        norm = (
            db.query(NormalizedEvent)
            .filter(NormalizedEvent.raw_payload_reference == existing.id)
            .order_by(NormalizedEvent.created_at.desc())
            .first()
        )
        return IngestEventResponse(
            raw_event_id=existing.id,
            event_id=norm.event_id if norm else existing.id,
            duplicate=True,
            incident_id=norm.incident_id if norm else None,
            normalized_signal_type=norm.normalized_signal_type if norm else None,
        )

    raw_id = str(uuid.uuid4())
    ph = envelope.payload_hash or _payload_hash(payload)
    raw = RawEvent(
        id=raw_id,
        idempotency_key=idem,
        payload_hash=ph,
        system_id=envelope.system_id,
        payload=payload,
    )
    db.add(raw)

    try:
        adapted = adapt_raw_envelope(envelope)
    except (AdapterError, ValueError) as exc:
        db.rollback()
        raise ValueError(str(exc)) from exc

    system = db.get(System, envelope.system_id)
    owner_team = system.owner_team if system else None
    controls = list(system.applicable_control_ids) if system else []

    event = normalize_adapted(
        adapted,
        raw_event_id=raw_id,
        system_owner_team=owner_team,
        applicable_control_ids=controls,
    )

    rules = db.query(DetectionRule).filter(DetectionRule.enabled.is_(True)).all()
    match = evaluate_event(event, rules)
    incident_id: str | None = None

    if match:
        event.normalized_signal_type = match.signal_type
        event.severity = match.severity  # type: ignore[assignment]
        event.correlation_key = correlation_key_for(
            event.system_id,
            match.signal_type,
            event.environment,
            match.rule_id,
        )
        active = find_active_incident(db, correlation_key=event.correlation_key, as_of=event.timestamp)
        if active:
            update_incident_recurrence(
                db,
                incident=active,
                event=event,
                note="Correlated recurrence within active window",
            )
            incident_id = active.id
            event.incident_id = incident_id
        else:
            incident = create_incident_from_detection(db, event=event, match=match)
            incident_id = incident.id
            event.incident_id = incident_id
    elif event.evaluation_signals.get("recurrence") and event.correlation_key:
        active = find_active_incident(db, correlation_key=event.correlation_key, as_of=event.timestamp)
        if active:
            update_incident_recurrence(
                db,
                incident=active,
                event=event,
                note="Recurrence/correlation update",
            )
            incident_id = active.id
            event.incident_id = incident_id

    _persist_normalized(db, event)
    db.commit()

    await broadcaster.publish(
        "normalized_event",
        {"event_id": event.event_id, "system_id": event.system_id, "incident_id": incident_id},
    )
    if incident_id:
        await broadcaster.publish("incident.updated", {"incident_id": incident_id})

    return IngestEventResponse(
        raw_event_id=raw_id,
        event_id=event.event_id,
        duplicate=False,
        incident_id=incident_id,
        normalized_signal_type=event.normalized_signal_type,
    )
