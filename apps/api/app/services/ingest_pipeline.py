from __future__ import annotations

import hashlib
import json
import uuid
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models import DetectionRule, NormalizedEvent, RawEvent, System
from app.correlation.engine import is_correlation_eligible, process_correlation_event, reassess_cluster_for_incident
from app.detection.engine import evaluate_event
from app.pipeline.adapters.otel_agent import adapt_v2_span
from app.pipeline.adapters.router import AdapterError, adapt_raw_envelope
from app.pipeline.normalizer import correlation_key_for, normalize_adapted
from app.schemas.fleetrac_event import FleetracEvent
from app.schemas.ingestion import IngestEventResponse, RawIngestEnvelope
from app.services.event_stream import broadcaster
from app.services.ingest_validator import validate_envelope
from app.simulator.trace_builder import iso_from_nano

UNKNOWN_SYSTEM_ERROR = "unknown_system"
MAX_RAW_ENVELOPES = 10_000
MAX_NORMALIZED_ROWS = 5_000


def _payload_hash(payload: dict[str, Any]) -> str:
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(raw.encode()).hexdigest()
    return f"sha256:{digest}"


def _is_v2_bundle(payload: dict[str, Any]) -> bool:
    return payload.get("schema_version") == "2.0" and isinstance(payload.get("spans"), list)


def _prune_retention(db: Session) -> None:
    raw_count = db.query(func.count(RawEvent.id)).scalar() or 0
    if raw_count > MAX_RAW_ENVELOPES:
        excess = raw_count - MAX_RAW_ENVELOPES
        oldest = (
            db.query(RawEvent.id)
            .order_by(RawEvent.ingested_at.asc())
            .limit(excess)
            .all()
        )
        for (rid,) in oldest:
            db.query(NormalizedEvent).filter(NormalizedEvent.raw_envelope_id == rid).delete()
            db.query(NormalizedEvent).filter(NormalizedEvent.raw_payload_reference == rid).delete()
            db.query(RawEvent).filter(RawEvent.id == rid).delete()

    norm_count = db.query(func.count(NormalizedEvent.id)).scalar() or 0
    if norm_count > MAX_NORMALIZED_ROWS:
        excess = norm_count - MAX_NORMALIZED_ROWS
        oldest_norm = (
            db.query(NormalizedEvent.id)
            .order_by(NormalizedEvent.created_at.asc())
            .limit(excess)
            .all()
        )
        for (nid,) in oldest_norm:
            db.query(NormalizedEvent).filter(NormalizedEvent.id == nid).delete()


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
        signal_state=event.signal_state,
        normalized_signal_type=event.normalized_signal_type,
        severity=event.severity,
        confidence=event.confidence,
        evidence_reference=event.evidence_reference,
        raw_payload_reference=event.raw_payload_reference,
        raw_envelope_id=event.raw_envelope_id,
        accountable_owner_team=event.accountable_owner_team,
        owner_team=event.accountable_owner_team,
        applicable_control_ids=event.applicable_control_ids,
        correlation_key=event.correlation_key,
        incident_id=event.incident_id,
        content_mode=event.content_mode,
        payload_hash=event.payload_hash,
        scenario_run_id=event.scenario_run_id,
        simulator_run_id=event.simulator_run_id,
    )
    db.add(row)
    return row


def _bundle_business_outcome(payload: dict[str, Any]) -> str | None:
    outcome = payload.get("business_outcome")
    if isinstance(outcome, dict):
        status = outcome.get("status")
        return str(status) if status else None
    for span in payload.get("spans") or []:
        if not isinstance(span, dict):
            continue
        if span.get("operation") == "business.outcome" or span.get("name") == "business.outcome":
            attrs = span.get("attributes") or {}
            status = attrs.get("fleetrac.business_outcome.status")
            if status:
                return str(status)
    return None


def _apply_detection(
    db: Session,
    event: FleetracEvent,
    rules: list[DetectionRule],
    *,
    business_outcome: str | None = None,
) -> str | None:
    match = evaluate_event(event, rules)
    if not match and not is_correlation_eligible(event):
        return None
    return process_correlation_event(
        db,
        event,
        match=match,
        business_outcome=business_outcome,
    )


async def _process_v2_bundle(db: Session, payload: dict[str, Any]) -> IngestEventResponse:
    validation = validate_envelope(payload)
    if not validation.ok:
        raise ValueError("; ".join(validation.errors))

    system = db.get(System, payload["system_id"])
    if system is None:
        raise ValueError(UNKNOWN_SYSTEM_ERROR)

    idem = payload["idempotency_key"]
    existing = db.query(RawEvent).filter(RawEvent.idempotency_key == idem).one_or_none()
    if existing:
        norms = (
            db.query(NormalizedEvent)
            .filter(NormalizedEvent.raw_envelope_id == existing.id)
            .order_by(NormalizedEvent.created_at.asc())
            .all()
        )
        first = norms[0] if norms else None
        return IngestEventResponse(
            raw_event_id=existing.id,
            event_id=first.event_id if first else existing.id,
            duplicate=True,
            incident_id=first.incident_id if first else None,
            normalized_signal_type=first.normalized_signal_type if first else None,
            spans_accepted=len(norms),
            warnings=validation.warnings,
        )

    raw_id = str(uuid.uuid4())
    ph = payload.get("payload_hash") or _payload_hash(payload)
    raw = RawEvent(
        id=raw_id,
        idempotency_key=idem,
        payload_hash=ph,
        system_id=payload["system_id"],
        payload=payload,
    )
    db.add(raw)

    accountable_owner_team = system.owner_team
    controls = list(system.applicable_control_ids) if system.applicable_control_ids else []

    scenario_meta = payload.get("scenario") if isinstance(payload.get("scenario"), dict) else {}
    scenario_run_id = scenario_meta.get("run_id") if isinstance(scenario_meta, dict) else None
    simulator_run_id = payload.get("simulator_run_id")
    business_outcome = _bundle_business_outcome(payload)

    rules = db.query(DetectionRule).filter(DetectionRule.enabled.is_(True)).all()
    spans = payload.get("spans") or []
    last_event_id = raw_id
    last_signal: str | None = None
    incident_id: str | None = None
    accepted = 0

    for span in spans:
        if not isinstance(span, dict):
            continue
        start_ns = int(span.get("start_time_unix_nano") or 0)
        timestamp = iso_from_nano(start_ns) if start_ns else "2026-06-02T14:22:01.123Z"

        adapted = adapt_v2_span(payload, span, timestamp=timestamp)
        event = normalize_adapted(
            adapted,
            raw_event_id=raw_id,
            raw_envelope_id=raw_id,
            accountable_owner_team=accountable_owner_team,
            applicable_control_ids=controls,
            scenario_run_id=str(scenario_run_id) if scenario_run_id else None,
            simulator_run_id=str(simulator_run_id) if simulator_run_id else None,
        )

        span_incident = _apply_detection(db, event, rules, business_outcome=business_outcome)
        if span_incident:
            incident_id = span_incident

        if not span_incident and event.evaluation_signals.get("recurrence"):
            span_incident = process_correlation_event(
                db, event, business_outcome=business_outcome
            )
            if span_incident:
                incident_id = span_incident

        _persist_normalized(db, event)
        last_event_id = event.event_id
        last_signal = event.normalized_signal_type
        accepted += 1

    db.flush()
    if incident_id:
        reassess_cluster_for_incident(db, incident_id, raw_envelope_id=raw_id)

    _prune_retention(db)
    db.commit()

    await broadcaster.publish(
        "normalized_event",
        {"event_id": last_event_id, "system_id": payload["system_id"], "incident_id": incident_id},
    )
    if incident_id:
        await broadcaster.publish("incident.updated", {"incident_id": incident_id})

    return IngestEventResponse(
        raw_event_id=raw_id,
        event_id=last_event_id,
        duplicate=False,
        incident_id=incident_id,
        normalized_signal_type=last_signal,
        spans_accepted=accepted,
        warnings=validation.warnings,
    )


async def process_ingest_event(db: Session, payload: dict[str, Any]) -> IngestEventResponse:
    if _is_v2_bundle(payload):
        return await _process_v2_bundle(db, payload)

    validation = validate_envelope(payload)
    if not validation.ok:
        raise ValueError("; ".join(validation.errors))

    envelope = RawIngestEnvelope.model_validate(payload)
    idem = envelope.idempotency_key

    system = db.get(System, envelope.system_id)
    if system is None:
        raise ValueError(UNKNOWN_SYSTEM_ERROR)

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
            warnings=validation.warnings,
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

    accountable_owner_team = system.owner_team
    controls = list(system.applicable_control_ids) if system.applicable_control_ids else []

    scenario_meta = payload.get("scenario") if isinstance(payload.get("scenario"), dict) else {}
    scenario_run_id = scenario_meta.get("run_id") if isinstance(scenario_meta, dict) else None

    event = normalize_adapted(
        adapted,
        raw_event_id=raw_id,
        raw_envelope_id=raw_id,
        accountable_owner_team=accountable_owner_team,
        applicable_control_ids=controls,
        scenario_run_id=str(scenario_run_id) if scenario_run_id else None,
    )

    rules = db.query(DetectionRule).filter(DetectionRule.enabled.is_(True)).all()
    incident_id = _apply_detection(db, event, rules)

    if not incident_id and event.evaluation_signals.get("recurrence"):
        incident_id = process_correlation_event(db, event)
        if incident_id:
            event.incident_id = incident_id

    _persist_normalized(db, event)
    _prune_retention(db)
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
        warnings=validation.warnings,
    )
