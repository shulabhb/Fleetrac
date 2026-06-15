"""Output reliability control degradation policy."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from app.correlation.families import DIAGNOSIS_LABELS, OUTPUT_RELIABILITY, POLICY_VERSION
from app.correlation.models import CorrelationCandidate, RiskAssessmentResult
from app.correlation.policies.base import DiagnosisPolicy
from app.correlation.scoring import (
    apply_minimum,
    bool_score,
    confidence_from_score,
    deviation_score,
    recurrence_score,
    score_to_severity,
)
from app.db.models import SignalCluster
from app.slice_a.constants import THRESHOLD_VALUE


class OutputReliabilityPolicy(DiagnosisPolicy):
    diagnosis_family = OUTPUT_RELIABILITY
    diagnosis_label = DIAGNOSIS_LABELS[OUTPUT_RELIABILITY]
    risk_category = "Output Reliability"

    def evaluate_cluster(
        self,
        cluster: SignalCluster,
        candidates: list[CorrelationCandidate],
        *,
        system_profile: dict[str, Any] | None = None,
    ) -> RiskAssessmentResult:
        signals = set(cluster.signal_types or [])
        outcome = cluster.current_business_outcome or ""
        claim_rates = [
            float(c.relevant_attributes.get("unsupported_claim_rate", 0))
            for c in candidates
            if c.signal_type == "unsupported_claim_elevated"
        ]
        max_claim = max(claim_rates) if claim_rates else 0.0
        grounding_scores = [
            float(c.relevant_attributes.get("grounding_score", 1.0))
            for c in candidates
            if "grounding" in (c.source_span_name or "")
        ]
        min_grounding = min(grounding_scores) if grounding_scores else 1.0

        citation_failed = "citation_control_failure" in signals or any(
            c.relevant_attributes.get("citation_verified") is False for c in candidates
        )
        held_for_review = outcome == "held_for_review"
        published = outcome == "published"

        deviation = deviation_score(max_claim, THRESHOLD_VALUE)
        recurrence = recurrence_score(cluster.occurrence_count, cluster.trace_count)
        control_failure = bool_score(citation_failed)
        execution = 3 if published else (1 if held_for_review else 0)
        exposure = 2
        evidence_conf = 3 if max_claim > 0 else 1
        if min_grounding < 0.8:
            evidence_conf = min(3, evidence_conf + 1)

        score = deviation + recurrence + control_failure + execution + exposure + evidence_conf
        severity = score_to_severity(score)

        mitigating: list[str] = []
        why_not_higher: list[str] = []
        reasons: list[str] = []

        if max_claim > THRESHOLD_VALUE:
            reasons.append(
                f"Unsupported claim rate {max_claim:.3f} exceeded approved threshold {THRESHOLD_VALUE:.3f}"
            )
        if citation_failed:
            reasons.append("Citation verification failed on trace evidence")
        if cluster.trace_count >= 2:
            reasons.append(f"Pattern repeated across {cluster.trace_count} traces")
        if held_for_review:
            mitigating.append("Output held for human review before external publication")
            why_not_higher.append("No confirmed external publication occurred")
        if not citation_failed and severity != "critical":
            why_not_higher.append("Citation controls have not fully failed across all traces")

        if max_claim > THRESHOLD_VALUE and held_for_review:
            severity = apply_minimum(severity, "medium")
        if recurrence >= 2 and citation_failed:
            severity = apply_minimum(severity, "high")
        if published and max_claim > THRESHOLD_VALUE:
            severity = apply_minimum(severity, "critical")
        elif citation_failed and max_claim > THRESHOLD_VALUE:
            if held_for_review:
                severity = apply_minimum(severity, "high")
            else:
                severity = apply_minimum(severity, "critical")

        confidence, confidence_label = confidence_from_score(score, len(candidates))

        primary = [
            c.event_id
            for c in candidates
            if c.source_span_name in ("evaluate.unsupported_claims",) or c.signal_type == "unsupported_claim_elevated"
        ]
        supporting = [
            c.event_id
            for c in candidates
            if c.event_id not in primary
            and c.source_span_name in ("evaluate.grounding", "verify.citations", "citation.verify")
        ]
        mitigating_ids = [
            c.event_id for c in candidates if c.evidence_role == "mitigating" or c.source_span_name == "business.outcome"
        ]

        return RiskAssessmentResult(
            assessment_id=str(uuid.uuid4()),
            cluster_id=cluster.id,
            incident_id=cluster.incident_id,
            diagnosis_family=self.diagnosis_family,
            diagnosis_label=self.diagnosis_label,
            risk_category=self.risk_category,
            severity=severity,
            confidence=confidence,
            confidence_label=confidence_label,
            score=score,
            contributing_factors=reasons,
            mitigating_factors=mitigating,
            reasons=reasons,
            why_not_higher=why_not_higher,
            recommended_action=(
                "Restore citation fallback and require manual review until grounding and "
                "unsupported-claim metrics return to approved ranges"
            ),
            assessed_at=datetime.now(timezone.utc),
            policy_version=POLICY_VERSION,
            primary_evidence=primary,
            supporting_evidence=supporting,
            mitigating_evidence=mitigating_ids,
        )
