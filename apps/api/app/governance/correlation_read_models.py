"""Governance read models for correlation and risk assessment."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.db.models import Incident, RiskAssessment, SeverityHistory, SignalCluster


def incident_assessment(db: Session, incident_id: str) -> dict | None:
    from app.governance.read_models import _resolve_incident

    inc = _resolve_incident(db, incident_id)
    if inc is None:
        return None
    assessment = (
        db.query(RiskAssessment)
        .filter(RiskAssessment.incident_id == inc.id)
        .order_by(RiskAssessment.assessed_at.desc())
        .first()
    )
    if assessment is None:
        return None
    return {
        "assessment_id": assessment.id,
        "incident_id": inc.id,
        "alias_id": inc.alias_id,
        "cluster_id": assessment.cluster_id,
        "diagnosis_family": assessment.diagnosis_family,
        "severity": assessment.severity,
        "confidence": assessment.confidence,
        "score": assessment.score,
        "contributing_factors": assessment.contributing_factors,
        "mitigating_factors": assessment.mitigating_factors,
        "reasons": assessment.reasons,
        "why_not_higher": assessment.why_not_higher,
        "recommended_action": assessment.recommended_action,
        "assessed_at": assessment.assessed_at.isoformat(),
        "policy_version": assessment.policy_version,
        "occurrence_count": inc.occurrence_count,
        "trace_count": inc.trace_count,
        "severity_reason": inc.severity_reason,
    }


def incident_severity_history(db: Session, incident_id: str) -> dict:
    from app.governance.read_models import _resolve_incident

    inc = _resolve_incident(db, incident_id)
    if inc is None:
        return {"items": [], "total": 0}
    rows = (
        db.query(SeverityHistory)
        .filter(SeverityHistory.incident_id == inc.id)
        .order_by(SeverityHistory.changed_at.asc())
        .all()
    )
    items = [
        {
            "id": row.id,
            "previous_severity": row.previous_severity,
            "new_severity": row.new_severity,
            "score": row.score,
            "reason": row.reason,
            "assessment_id": row.assessment_id,
            "changed_at": row.changed_at.isoformat(),
        }
        for row in rows
    ]
    return {"items": items, "total": len(items)}


def correlation_cluster(db: Session, cluster_id: str) -> dict | None:
    cluster = db.get(SignalCluster, cluster_id)
    if cluster is None:
        return None
    return {
        "cluster_id": cluster.id,
        "correlation_key": cluster.correlation_key,
        "diagnosis_family": cluster.diagnosis_family,
        "system_id": cluster.system_id,
        "tenant_id": cluster.tenant_id,
        "environment": cluster.environment,
        "window_start": cluster.window_start.isoformat(),
        "window_end": cluster.window_end.isoformat(),
        "first_seen_at": cluster.first_seen_at.isoformat(),
        "last_seen_at": cluster.last_seen_at.isoformat(),
        "occurrence_count": cluster.occurrence_count,
        "trace_count": cluster.trace_count,
        "signal_types": cluster.signal_types,
        "contributing_event_ids": cluster.contributing_event_ids,
        "contributing_trace_ids": cluster.contributing_trace_ids,
        "current_business_outcome": cluster.current_business_outcome,
        "status": cluster.status,
        "incident_id": cluster.incident_id,
    }
