"""Platform reliability / routing degradation policy."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from app.correlation.families import DIAGNOSIS_LABELS, PLATFORM_RELIABILITY, POLICY_VERSION
from app.correlation.models import CorrelationCandidate, RiskAssessmentResult
from app.correlation.policies.base import DiagnosisPolicy
from app.correlation.scoring import (
    apply_maximum,
    apply_minimum,
    confidence_from_score,
    deviation_score,
    recurrence_score,
    score_to_severity,
)
from app.db.models import SignalCluster


class PlatformReliabilityPolicy(DiagnosisPolicy):
    diagnosis_family = PLATFORM_RELIABILITY
    diagnosis_label = DIAGNOSIS_LABELS[PLATFORM_RELIABILITY]
    risk_category = "Technology"

    def evaluate_cluster(
        self,
        cluster: SignalCluster,
        candidates: list[CorrelationCandidate],
        *,
        system_profile: dict[str, Any] | None = None,
    ) -> RiskAssessmentResult:
        outcome = cluster.current_business_outcome or ""
        latencies = [
            float(
                c.relevant_attributes.get("operation_latency_ms")
                or c.relevant_attributes.get("latency_ms")
                or 0
            )
            for c in candidates
            if c.source_span_name in ("model.reasoning", "model.generate", "model.summarize")
            or c.signal_type == "latency_regression"
        ]
        max_latency = max(latencies) if latencies else 0.0
        retries = max(float(c.relevant_attributes.get("retry_count", 0)) for c in candidates) if candidates else 0.0
        fallback_invoked = any(c.relevant_attributes.get("fallback_invoked") for c in candidates)
        fallback_failed = any(c.relevant_attributes.get("fallback_failed") for c in candidates)
        provider_error = "provider_error" in (cluster.signal_types or [])

        routed_ok = outcome in ("routed", "queued")
        routing_unavailable = outcome in ("routing_unavailable", "routing_degraded")

        deviation = deviation_score(max_latency, 800.0)
        recurrence = recurrence_score(cluster.occurrence_count, cluster.trace_count)
        retry_score = 3 if retries >= 5 else (2 if retries >= 2 else 0)
        fallback_score = 3 if fallback_failed else (1 if fallback_invoked else 0)
        routing_score = 3 if routing_unavailable else (1 if outcome == "escalated" else 0)
        exposure = 2 if routing_unavailable else 1

        score = deviation + recurrence + retry_score + fallback_score + routing_score + exposure
        severity = score_to_severity(score)

        mitigating: list[str] = []
        why_not_higher: list[str] = []
        reasons: list[str] = []

        if max_latency > 800:
            reasons.append(f"Provider operation latency {max_latency:.0f}ms exceeded 800ms threshold")
        if retries >= 2:
            reasons.append(f"Retry count elevated to {int(retries)}")
        if fallback_invoked:
            reasons.append("Fallback routing path invoked")
        if fallback_failed:
            reasons.append("Fallback routing path failed")
        if provider_error:
            reasons.append("Provider error signal observed")
        if cluster.trace_count >= 2:
            reasons.append(f"Sustained degradation across {cluster.trace_count} traces")
        if max_latency > 800 and routed_ok and not fallback_failed:
            mitigating.append("Routing completed successfully despite elevated latency")
            why_not_higher.append("Fallback path remained healthy and routing completed")

        if max_latency > 800 and (retries >= 2 or routing_unavailable):
            severity = apply_minimum(severity, "high")
        if (provider_error or fallback_failed) and routing_unavailable:
            severity = apply_minimum(severity, "critical")
        if max_latency > 800 and routed_ok and not fallback_failed and not routing_unavailable:
            severity = apply_maximum(severity, "medium")

        confidence, confidence_label = confidence_from_score(score, len(candidates))

        primary = [
            c.event_id
            for c in candidates
            if c.source_span_name in ("model.reasoning", "model.generate")
            or c.signal_type == "latency_regression"
        ]
        supporting = [
            c.event_id
            for c in candidates
            if c.event_id not in primary
            and c.source_span_name in ("route.select", "queue.assign")
        ]
        mitigating_ids = [c.event_id for c in candidates if c.evidence_role == "mitigating"]

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
                "Review provider routing configuration and prepare rollback candidate "
                "if queue impact persists beyond approved SLO"
            ),
            assessed_at=datetime.now(timezone.utc),
            policy_version=POLICY_VERSION,
            primary_evidence=primary,
            supporting_evidence=supporting,
            mitigating_evidence=mitigating_ids,
        )
