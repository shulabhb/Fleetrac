"""Structured Fleetrac Analysis from risk assessments."""

from __future__ import annotations

from typing import Any

from app.correlation.models import RiskAssessmentResult
from app.fleet.registry import SYSTEM_BY_ID, incident_alias
from app.schemas.analysis import FleetracAnalysis


def build_assessment_analysis(
    incident_id: str,
    *,
    system_id: str,
    signal_type: str,
    assessment: RiskAssessmentResult,
    occurrence_count: int,
    trace_count: int,
) -> dict[str, Any]:
    system = SYSTEM_BY_ID.get(system_id)
    name = system.name if system else system_id
    alias = incident_alias(system_id, signal_type)

    executive = (
        f"{assessment.diagnosis_label} on {name}. "
        f"Severity {assessment.severity.title()} with {assessment.confidence_label} confidence."
    )
    if assessment.reasons:
        executive += f" {assessment.reasons[0]}."

    analysis = FleetracAnalysis(
        incident_id=incident_id,
        alias_id=alias,
        summary=executive,
        bounded_scope=(
            "Analysis is limited to correlated governance signals, evaluation metadata, "
            "and packaged evidence references. No autonomous remediation is proposed."
        ),
        recommended_actions=[assessment.recommended_action],
        evidence_highlights=assessment.contributing_factors[:6],
        policy_notes=f"Fleetrac policy {assessment.policy_version}; diagnosis-family assessment.",
        confidence=assessment.confidence,
    )

    structured: dict[str, Any] = analysis.model_dump()
    structured.update(
        {
            "diagnosis": assessment.diagnosis_label,
            "executive_summary": executive,
            "current_severity": assessment.severity,
            "assessment_confidence": assessment.confidence_label,
            "why_this_severity": assessment.reasons,
            "why_not_higher": assessment.why_not_higher,
            "contributing_signals": assessment.contributing_factors,
            "mitigating_factors": assessment.mitigating_factors,
            "affected_controls": [],
            "evidence_coverage": {
                "primary": assessment.primary_evidence,
                "supporting": assessment.supporting_evidence,
                "mitigating": assessment.mitigating_evidence,
            },
            "likely_cause": assessment.diagnosis_label,
            "business_consequence": assessment.reasons[-1] if assessment.reasons else "Governance deviation detected",
            "recommended_bounded_action": assessment.recommended_action,
            "limitations": "Deterministic template assessment; no LLM investigation.",
            "last_updated": assessment.assessed_at.isoformat(),
            "occurrence_count": occurrence_count,
            "trace_count": trace_count,
            "score": assessment.score,
            "policy_version": assessment.policy_version,
        }
    )
    return structured
