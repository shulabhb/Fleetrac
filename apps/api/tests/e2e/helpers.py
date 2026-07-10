"""Shared synchronous E2E helpers — HTTP simulator API + governance assertions."""

from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import EvidenceItem, EvidenceRecord, Incident, NormalizedEvent, RawEvent


def reset_simulator(client: TestClient) -> None:
    client.post("/api/v1/simulator/stop")
    resp = client.post("/api/v1/simulator/reset")
    assert resp.status_code == 200, resp.text


def run_scenario_via_api(
    client: TestClient,
    scenario_id: str,
    system_id: str,
    *,
    impact_mode: str | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {"system_id": system_id}
    if impact_mode:
        payload["impact_mode"] = impact_mode
    resp = client.post(
        f"/api/v1/simulator/scenarios/{scenario_id}",
        json=payload,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body.get("failed") is None, body
    assert body.get("posted", 0) >= 1
    return body


def incident_by_alias(db: Session, alias_id: str) -> Incident:
    inc = db.query(Incident).filter(Incident.alias_id == alias_id).one_or_none()
    assert inc is not None, f"incident alias {alias_id} not found"
    return inc


def span_names_for_incident(db: Session, incident_id: str) -> set[str]:
    norms = (
        db.query(NormalizedEvent)
        .filter(NormalizedEvent.incident_id == incident_id)
        .all()
    )
    if not norms:
        return set()
    trace_id = norms[0].trace_id
    all_trace_norms = (
        db.query(NormalizedEvent).filter(NormalizedEvent.trace_id == trace_id).all()
        if trace_id
        else norms
    )
    names: set[str] = set()
    for norm in all_trace_norms:
        span_name = (norm.evaluation_signals or {}).get("span_name")
        if span_name:
            names.add(str(span_name))
            continue
        raw = db.get(RawEvent, norm.raw_envelope_id or norm.raw_payload_reference)
        if raw and raw.payload:
            for sp in raw.payload.get("spans") or []:
                if sp.get("span_id") == norm.span_id:
                    names.add(str(sp.get("name")))
    return names


def governed_span_names(db: Session, incident_id: str) -> set[str]:
    norms = (
        db.query(NormalizedEvent)
        .filter(
            NormalizedEvent.incident_id == incident_id,
            NormalizedEvent.normalized_signal_type.isnot(None),
        )
        .all()
    )
    out: set[str] = set()
    for norm in norms:
        name = (norm.evaluation_signals or {}).get("span_name")
        if name:
            out.add(str(name))
    return out


def evidence_item_span_ids(db: Session, incident_id: str) -> list[str]:
    record = db.query(EvidenceRecord).filter(EvidenceRecord.incident_id == incident_id).one_or_none()
    if record is None:
        return []
    items = (
        db.query(EvidenceItem)
        .filter(EvidenceItem.evidence_record_id == record.id, EvidenceItem.kind == "normalized_event")
        .all()
    )
    span_ids: list[str] = []
    for item in items:
        norm = db.query(NormalizedEvent).filter(NormalizedEvent.event_id == item.reference_id).one_or_none()
        if norm and norm.span_id:
            span_ids.append(norm.span_id)
    return span_ids


def assert_evidence_api(client: TestClient, alias_id: str, canonical_id: str) -> dict[str, Any]:
    resp = client.get(f"/api/v1/governance/evidence/{alias_id}")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["incident_id"] == canonical_id
    assert body["alias_id"] == alias_id
    assert body.get("fleetrac_analysis")
    assert len(body.get("items") or []) >= 1
    return body


def assert_owner_queue_contains(client: TestClient, owner_team: str, alias_id: str) -> None:
    resp = client.get("/api/v1/governance/owner-queue", params={"owner_team": owner_team})
    assert resp.status_code == 200
    items = resp.json().get("items") or []
    assert any(row.get("alias_id") == alias_id for row in items), items
