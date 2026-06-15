"""Correlation engine — cluster signals, assess risk, evolve incidents."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.correlation.analysis_builder import build_assessment_analysis
from app.correlation.families import (
    CORRELATION_WINDOW_MINUTES,
    cluster_correlation_key,
    diagnosis_family_for,
    infer_supporting_signal_type,
)
from app.correlation.models import CorrelationCandidate, RiskAssessmentResult
from app.correlation.policies import POLICY_BY_FAMILY
from app.db.models import FleetracAnalysisRow, Incident, RiskAssessment, SeverityHistory, SignalCluster
from app.detection.engine import DetectionMatch
from app.fleet.registry import SYSTEM_BY_ID, canonical_incident_id, incident_alias, responder_team_for_risk
from app.governance.evidence import append_cluster_evidence, ensure_evidence_for_incident
from app.governance.incidents import _history_entry, _incident_title
from app.governance.notifications import record_notification_and_assignment
from app.schemas.fleetrac_event import FleetracEvent


def is_correlation_eligible(event: FleetracEvent) -> bool:
    if event.normalized_signal_type is None and event.signal_state == "healthy":
        return False
    if event.operation_type == "wait":
        return False
    span_name = (event.evaluation_signals or {}).get("span_name")
    if span_name and str(span_name).endswith(".wait"):
        return False
    signal = infer_supporting_signal_type(event)
    if signal and diagnosis_family_for(event.system_id, signal):
        return True
    return event.signal_state in ("governance", "warning") and bool(event.normalized_signal_type)


def _evidence_role(signal_type: str, span_name: str | None, diagnosis_family: str) -> str:
    if diagnosis_family.endswith("degradation") or "reliability" in diagnosis_family:
        if span_name == "business.outcome" or signal_type == "recurrence_detected":
            return "mitigating" if span_name == "business.outcome" else "supporting"
        if span_name in ("evaluate.unsupported_claims",) or signal_type == "unsupported_claim_elevated":
            return "primary"
    if "tool_governance" in diagnosis_family or "violation" in diagnosis_family:
        if span_name in ("quarantine.route",) or signal_type == "tool_scope_violation":
            return "primary"
    if "routing" in diagnosis_family or "provider" in diagnosis_family:
        if span_name in ("model.reasoning",) or signal_type == "latency_regression":
            return "primary"
        if span_name == "business.outcome":
            return "mitigating"
    if span_name == "business.outcome":
        return "mitigating"
    return "supporting"


def candidate_from_event(
    event: FleetracEvent,
    *,
    match: DetectionMatch | None = None,
    business_outcome: str | None = None,
) -> CorrelationCandidate | None:
    signal_type = match.signal_type if match else infer_supporting_signal_type(event)
    if not signal_type:
        return None
    family = diagnosis_family_for(event.system_id, signal_type)
    if not family:
        return None

    evaluation = dict(event.evaluation_signals or {})
    span_name = evaluation.get("span_name")
    if event.policy_result:
        evaluation.setdefault("policy_result", event.policy_result)
    if event.tool:
        evaluation.setdefault("gen_ai.tool.name", event.tool)

    role = _evidence_role(signal_type, str(span_name) if span_name else None, family)
    risk_category = match.risk_category if match else "Governance"

    return CorrelationCandidate(
        candidate_id=str(uuid.uuid4()),
        tenant_id=event.tenant_id,
        environment=event.environment,
        system_id=event.system_id,
        trace_id=event.trace_id,
        span_id=event.span_id,
        event_id=event.event_id,
        signal_type=signal_type,
        risk_category=risk_category,
        timestamp=event.timestamp,
        severity_hint=match.severity if match else event.severity,
        confidence_hint=event.confidence,
        source_span_name=str(span_name) if span_name else event.operation_type,
        control_ids=list(event.applicable_control_ids or []),
        relevant_attributes=evaluation,
        business_outcome=business_outcome,
        evidence_role=role,
        rule_id=match.rule_id if match else None,
        metric_value=match.metric_value if match else None,
    )


def find_active_cluster(
    db: Session,
    *,
    correlation_key: str,
    as_of: datetime,
) -> SignalCluster | None:
    window_start = as_of - timedelta(minutes=CORRELATION_WINDOW_MINUTES)
    if as_of.tzinfo is None:
        as_of = as_of.replace(tzinfo=timezone.utc)
        window_start = window_start.replace(tzinfo=timezone.utc)

    clusters = (
        db.query(SignalCluster)
        .filter(
            SignalCluster.correlation_key == correlation_key,
            SignalCluster.status == "open",
        )
        .order_by(SignalCluster.last_seen_at.desc())
        .all()
    )
    for cluster in clusters:
        last_seen = cluster.last_seen_at
        if last_seen.tzinfo is None:
            last_seen = last_seen.replace(tzinfo=timezone.utc)
        if last_seen >= window_start:
            return cluster
    return None


def _append_unique(target: list[str], value: str | None) -> None:
    if value and value not in target:
        target.append(value)


def _update_cluster(cluster: SignalCluster, candidate: CorrelationCandidate) -> None:
    cluster.last_seen_at = candidate.timestamp
    cluster.window_end = candidate.timestamp
    _append_unique(cluster.signal_types, candidate.signal_type)
    _append_unique(cluster.contributing_event_ids, candidate.event_id)
    _append_unique(cluster.contributing_trace_ids, candidate.trace_id)
    _append_unique(cluster.contributing_span_ids, candidate.span_id)
    for cid in candidate.control_ids:
        _append_unique(cluster.control_ids, cid)
    if candidate.business_outcome:
        cluster.current_business_outcome = candidate.business_outcome
    cluster.occurrence_count = len(cluster.contributing_event_ids or [])
    cluster.trace_count = len(cluster.contributing_trace_ids or [])


def _create_cluster(
    db: Session,
    candidate: CorrelationCandidate,
    *,
    diagnosis_family: str,
    correlation_key: str,
) -> SignalCluster:
    cluster = SignalCluster(
        id=str(uuid.uuid4()),
        tenant_id=candidate.tenant_id,
        environment=candidate.environment,
        system_id=candidate.system_id,
        diagnosis_family=diagnosis_family,
        correlation_key=correlation_key,
        window_start=candidate.timestamp,
        window_end=candidate.timestamp,
        first_seen_at=candidate.timestamp,
        last_seen_at=candidate.timestamp,
        occurrence_count=1,
        trace_count=1 if candidate.trace_id else 0,
        signal_types=[candidate.signal_type],
        contributing_event_ids=[candidate.event_id],
        contributing_trace_ids=[candidate.trace_id] if candidate.trace_id else [],
        contributing_span_ids=[candidate.span_id] if candidate.span_id else [],
        control_ids=list(candidate.control_ids),
        current_business_outcome=candidate.business_outcome,
        status="open",
    )
    db.add(cluster)
    db.flush()
    return cluster


def _primary_signal_type(diagnosis_family: str) -> str:
    mapping = {
        "output_reliability_control_degradation": "unsupported_claim_elevated",
        "prompt_injection_tool_governance_violation": "tool_scope_violation",
        "provider_degradation_routing_reliability": "latency_regression",
    }
    return mapping.get(diagnosis_family, "governance_signal")


def _upsert_incident(
    db: Session,
    *,
    cluster: SignalCluster,
    assessment: RiskAssessmentResult,
    trigger_event: FleetracEvent,
    match: DetectionMatch | None,
) -> Incident:
    signal_type = match.signal_type if match else _primary_signal_type(cluster.diagnosis_family)
    system = SYSTEM_BY_ID.get(cluster.system_id)
    system_name = system.name if system else cluster.system_id
    canonical_id = canonical_incident_id(cluster.system_id, signal_type)
    alias_id = incident_alias(cluster.system_id, signal_type)
    accountable = system.owner_team if system else (trigger_event.accountable_owner_team or "Model Risk Management")
    responder = responder_team_for_risk(assessment.risk_category, fallback=accountable)

    incident = db.get(Incident, canonical_id)
    if incident is None:
        incident = db.query(Incident).filter(Incident.alias_id == alias_id).one_or_none()

    if incident is None:
        rule_id = match.rule_id if match else "correlation_policy"
        priority = match.priority if match else "P1"
        lifecycle = match.lifecycle_final if match else "Owner Review"
        incident = Incident(
            id=canonical_id,
            alias_id=alias_id,
            system_id=cluster.system_id,
            correlation_key=cluster.correlation_key,
            rule_id=rule_id,
            signal_type=signal_type,
            classification_category=assessment.risk_category,
            severity=assessment.severity,
            priority=priority,
            lifecycle=lifecycle,
            accountable_owner_team=accountable,
            responder_team=responder,
            owner_team=responder,
            title=_incident_title(system_name, assessment.diagnosis_label),
            summary="; ".join(assessment.reasons) or assessment.diagnosis_label,
            lifecycle_history=[
                _history_entry("Packaged", note="Evidence packaged from correlated governance signals"),
                _history_entry(lifecycle, note="Routed to owner queue"),
            ],
            diagnosis_family=cluster.diagnosis_family,
            highest_severity=assessment.severity,
            assessment_confidence=assessment.confidence,
            severity_reason="; ".join(assessment.reasons[:3]),
            last_assessed_at=assessment.assessed_at,
            occurrence_count=cluster.occurrence_count,
            trace_count=cluster.trace_count,
            cluster_id=cluster.id,
        )
        db.add(incident)
        db.flush()
        ensure_evidence_for_incident(
            db,
            incident_id=incident.id,
            normalized_event_id=trigger_event.event_id,
            raw_event_id=trigger_event.raw_payload_reference,
            metric_value=match.metric_value if match else float(assessment.score),
            summary=(
                f"{assessment.diagnosis_label}: "
                f"{trigger_event.evaluation_signals.get('span_name') or trigger_event.operation_type}"
            ),
            signal_type=signal_type,
            system_id=cluster.system_id,
        )
        record_notification_and_assignment(
            db,
            incident_id=incident.id,
            title=incident.title,
            owner_team=incident.responder_team,
        )
        return incident

    previous = incident.severity
    incident.severity = assessment.severity
    incident.highest_severity = _max_severity(incident.highest_severity or previous, assessment.severity)
    incident.assessment_confidence = assessment.confidence
    incident.severity_reason = "; ".join(assessment.reasons[:3])
    incident.last_assessed_at = assessment.assessed_at
    incident.occurrence_count = cluster.occurrence_count
    incident.trace_count = cluster.trace_count
    incident.cluster_id = cluster.id
    incident.diagnosis_family = cluster.diagnosis_family
    incident.correlation_key = cluster.correlation_key
    incident.summary = (
        f"{assessment.diagnosis_label} | "
        f"occurrences={cluster.occurrence_count} traces={cluster.trace_count}"
        + (f" | recurrence across {cluster.trace_count} traces" if cluster.trace_count > 1 else "")
        + " | "
        + "; ".join(assessment.reasons[:2])
    )
    if previous != assessment.severity:
        incident.lifecycle_history = list(incident.lifecycle_history or []) + [
            _history_entry(
                incident.lifecycle,
                note=f"Severity {previous} → {assessment.severity}: {'; '.join(assessment.reasons[:2])}",
            )
        ]
        db.add(
            SeverityHistory(
                id=str(uuid.uuid4()),
                incident_id=incident.id,
                previous_severity=previous,
                new_severity=assessment.severity,
                score=float(assessment.score),
                reason="; ".join(assessment.reasons[:3]),
                assessment_id=assessment.assessment_id,
            )
        )
    return incident


def _max_severity(a: str, b: str) -> str:
    order = {"medium": 1, "high": 2, "critical": 3}
    return a if order.get(a, 0) >= order.get(b, 0) else b


def _persist_assessment(db: Session, assessment: RiskAssessmentResult, incident_id: str) -> None:
    row = RiskAssessment(
        id=assessment.assessment_id,
        cluster_id=assessment.cluster_id,
        incident_id=incident_id,
        diagnosis_family=assessment.diagnosis_family,
        risk_category=assessment.risk_category,
        severity=assessment.severity,
        confidence=assessment.confidence,
        score=float(assessment.score),
        contributing_factors=assessment.contributing_factors,
        mitigating_factors=assessment.mitigating_factors,
        reasons=assessment.reasons,
        why_not_higher=assessment.why_not_higher,
        recommended_action=assessment.recommended_action,
        assessed_at=assessment.assessed_at,
        policy_version=assessment.policy_version,
        primary_evidence=assessment.primary_evidence,
        supporting_evidence=assessment.supporting_evidence,
        mitigating_evidence=assessment.mitigating_evidence,
    )
    db.add(row)

    template = build_assessment_analysis(
        incident_id,
        system_id=assessment.cluster_id and "",  # patched below
        signal_type=_primary_signal_type(assessment.diagnosis_family),
        assessment=assessment,
        occurrence_count=0,
        trace_count=0,
    )
    # Fix system_id from cluster
    cluster = db.get(SignalCluster, assessment.cluster_id)
    if cluster:
        template = build_assessment_analysis(
            incident_id,
            system_id=cluster.system_id,
            signal_type=_primary_signal_type(assessment.diagnosis_family),
            assessment=assessment,
            occurrence_count=cluster.occurrence_count,
            trace_count=cluster.trace_count,
        )

    analysis_row = (
        db.query(FleetracAnalysisRow).filter(FleetracAnalysisRow.incident_id == incident_id).one_or_none()
    )
    if analysis_row is not None:
        analysis_row.template = template
    else:
        db.add(
            FleetracAnalysisRow(
                id=str(uuid.uuid4()),
                incident_id=incident_id,
                template=template,
            )
        )


def _cluster_candidates(db: Session, cluster: SignalCluster) -> list[CorrelationCandidate]:
    """Reconstruct lightweight candidates from cluster metadata for assessment."""
    from app.db.models import NormalizedEvent

    candidates: list[CorrelationCandidate] = []
    for event_id in cluster.contributing_event_ids or []:
        norm = db.query(NormalizedEvent).filter(NormalizedEvent.event_id == event_id).one_or_none()
        if norm is None:
            continue
        signal = norm.normalized_signal_type or infer_supporting_signal_type_from_norm(norm)
        if not signal:
            continue
        evaluation = dict(norm.evaluation_signals or {})
        span_name = evaluation.get("span_name")
        candidates.append(
            CorrelationCandidate(
                candidate_id=event_id,
                tenant_id=norm.tenant_id,
                environment=norm.environment,
                system_id=norm.system_id,
                trace_id=norm.trace_id,
                span_id=norm.span_id,
                event_id=norm.event_id,
                signal_type=signal,
                risk_category=cluster.diagnosis_family,
                timestamp=norm.timestamp,
                source_span_name=str(span_name) if span_name else norm.operation_type,
                control_ids=list(norm.applicable_control_ids or []),
                relevant_attributes=evaluation,
                business_outcome=cluster.current_business_outcome,
                evidence_role=_evidence_role(
                    signal,
                    str(span_name) if span_name else None,
                    cluster.diagnosis_family,
                ),
            )
        )
    return candidates


def infer_supporting_signal_type_from_norm(norm) -> str | None:
    class _Evt:
        normalized_signal_type = norm.normalized_signal_type
        evaluation_signals = norm.evaluation_signals
        policy_result = norm.policy_result
        operation_type = norm.operation_type

    return infer_supporting_signal_type(_Evt())  # type: ignore[arg-type]


def _enrich_cluster_from_bundle(
    db: Session,
    cluster: SignalCluster,
    *,
    raw_envelope_id: str,
) -> None:
    from app.db.models import NormalizedEvent

    norms = (
        db.query(NormalizedEvent)
        .filter(
            NormalizedEvent.raw_envelope_id == raw_envelope_id,
            NormalizedEvent.system_id == cluster.system_id,
        )
        .all()
    )
    for norm in norms:
        signal = norm.normalized_signal_type or infer_supporting_signal_type_from_norm(norm)
        if not signal:
            continue
        if diagnosis_family_for(norm.system_id, signal) != cluster.diagnosis_family:
            continue
        pseudo = CorrelationCandidate(
            candidate_id=norm.event_id,
            tenant_id=norm.tenant_id,
            environment=norm.environment,
            system_id=norm.system_id,
            trace_id=norm.trace_id,
            span_id=norm.span_id,
            event_id=norm.event_id,
            signal_type=signal,
            risk_category=cluster.diagnosis_family,
            timestamp=norm.timestamp,
            source_span_name=str((norm.evaluation_signals or {}).get("span_name") or norm.operation_type),
            control_ids=list(norm.applicable_control_ids or []),
            relevant_attributes=dict(norm.evaluation_signals or {}),
            business_outcome=cluster.current_business_outcome,
            evidence_role=_evidence_role(
                signal,
                str((norm.evaluation_signals or {}).get("span_name") or ""),
                cluster.diagnosis_family,
            ),
        )
        _update_cluster(cluster, pseudo)


def reassess_cluster_for_incident(
    db: Session,
    incident_id: str,
    *,
    raw_envelope_id: str | None = None,
) -> str | None:
    """Re-run policy assessment after all spans in a bundle are persisted."""
    from app.db.models import NormalizedEvent

    incident = db.get(Incident, incident_id)
    if incident is None or not incident.cluster_id:
        return incident_id

    cluster = db.get(SignalCluster, incident.cluster_id)
    if cluster is None:
        return incident_id

    if raw_envelope_id:
        _enrich_cluster_from_bundle(db, cluster, raw_envelope_id=raw_envelope_id)

    policy = POLICY_BY_FAMILY.get(cluster.diagnosis_family)
    if policy is None:
        return incident_id

    candidates = _cluster_candidates(db, cluster)
    if not candidates:
        return incident_id

    assessment = policy.evaluate_cluster(cluster, candidates)
    assessment.cluster_id = cluster.id
    assessment.incident_id = incident.id

    previous = incident.severity
    incident.severity = assessment.severity
    incident.highest_severity = _max_severity(incident.highest_severity or previous, assessment.severity)
    incident.assessment_confidence = assessment.confidence
    incident.severity_reason = "; ".join(assessment.reasons[:3])
    incident.last_assessed_at = assessment.assessed_at
    incident.occurrence_count = cluster.occurrence_count
    incident.trace_count = cluster.trace_count

    if previous != assessment.severity:
        db.add(
            SeverityHistory(
                id=str(uuid.uuid4()),
                incident_id=incident.id,
                previous_severity=previous,
                new_severity=assessment.severity,
                score=float(assessment.score),
                reason="; ".join(assessment.reasons[:3]),
                assessment_id=assessment.assessment_id,
            )
        )

    _persist_assessment(db, assessment, incident.id)
    return incident.id


def process_correlation_event(
    db: Session,
    event: FleetracEvent,
    *,
    match: DetectionMatch | None = None,
    business_outcome: str | None = None,
) -> str | None:
    if match:
        event.signal_state = "governance"
        event.normalized_signal_type = match.signal_type
        event.severity = match.severity  # type: ignore[assignment]
        event.confidence = min(0.99, 0.5 + (match.metric_value or 0))

    if not is_correlation_eligible(event) and not match:
        return None

    candidate = candidate_from_event(event, match=match, business_outcome=business_outcome)
    if candidate is None:
        return None

    diagnosis_family = diagnosis_family_for(candidate.system_id, candidate.signal_type)
    if not diagnosis_family:
        return None

    correlation_key = cluster_correlation_key(
        tenant_id=candidate.tenant_id,
        environment=candidate.environment,
        system_id=candidate.system_id,
        diagnosis_family=diagnosis_family,
    )
    event.correlation_key = correlation_key

    cluster = find_active_cluster(db, correlation_key=correlation_key, as_of=candidate.timestamp)
    if cluster is None:
        cluster = _create_cluster(
            db,
            candidate,
            diagnosis_family=diagnosis_family,
            correlation_key=correlation_key,
        )
    else:
        _update_cluster(cluster, candidate)

    policy = POLICY_BY_FAMILY.get(diagnosis_family)
    if policy is None:
        return None

    candidates = _cluster_candidates(db, cluster)
    if not any(c.event_id == candidate.event_id for c in candidates):
        candidates.append(candidate)

    assessment = policy.evaluate_cluster(cluster, candidates)
    assessment.cluster_id = cluster.id

    incident = _upsert_incident(
        db,
        cluster=cluster,
        assessment=assessment,
        trigger_event=event,
        match=match,
    )
    cluster.incident_id = incident.id
    assessment.incident_id = incident.id

    _persist_assessment(db, assessment, incident.id)

    append_cluster_evidence(
        db,
        incident_id=incident.id,
        candidate=candidate,
        assessment=assessment,
    )

    event.incident_id = incident.id
    event.severity = assessment.severity  # type: ignore[assignment]
    event.confidence = assessment.confidence
    return incident.id
