"""Tool governance violation policy."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from app.correlation.families import DIAGNOSIS_LABELS, POLICY_VERSION, TOOL_GOVERNANCE
from app.correlation.models import CorrelationCandidate, RiskAssessmentResult
from app.correlation.policies.base import DiagnosisPolicy
from app.correlation.scoring import (
    apply_minimum,
    confidence_from_score,
    recurrence_score,
    score_to_severity,
)
from app.db.models import SignalCluster


class ToolGovernancePolicy(DiagnosisPolicy):
    diagnosis_family = TOOL_GOVERNANCE
    diagnosis_label = DIAGNOSIS_LABELS[TOOL_GOVERNANCE]
    risk_category = "Cyber"

    def evaluate_cluster(
        self,
        cluster: SignalCluster,
        candidates: list[CorrelationCandidate],
        *,
        system_profile: dict[str, Any] | None = None,
    ) -> RiskAssessmentResult:
        signals = set(cluster.signal_types or [])
        outcome = cluster.current_business_outcome or ""

        restricted_attempt = any(
            c.signal_type in ("tool_scope_violation", "restricted_tool_attempt", "policy_denial")
            for c in candidates
        )
        policy_denied = any(c.relevant_attributes.get("policy_result") == "deny" for c in candidates)
        tool_blocked = any(c.relevant_attributes.get("tool_approved") is False for c in candidates)
        executed = outcome == "unauthorized_action_executed" or any(
            c.relevant_attributes.get("tool_execution_succeeded") for c in candidates
        )
        repeated = cluster.occurrence_count >= 2 or cluster.trace_count >= 2

        score = 0
        if restricted_attempt:
            score += 3
        if policy_denied or tool_blocked:
            score += 2
        score += recurrence_score(cluster.occurrence_count, cluster.trace_count)
        if executed:
            score += 6
        elif repeated:
            score += 2

        severity = score_to_severity(score)
        mitigating: list[str] = []
        why_not_higher: list[str] = []
        reasons: list[str] = []

        if restricted_attempt:
            reasons.append("Restricted tool invocation attempted outside approved policy scope")
        if policy_denied:
            reasons.append("Policy engine denied tool execution")
        if repeated:
            reasons.append(f"Repeated restricted-tool attempts across {cluster.trace_count} traces")
        if tool_blocked:
            mitigating.append("Tool execution blocked by policy gate")
            why_not_higher.append("Unauthorized tool execution did not succeed")

        if restricted_attempt and (policy_denied or tool_blocked) and not executed:
            severity = apply_minimum(severity, "medium")
        if repeated and (policy_denied or tool_blocked):
            severity = apply_minimum(severity, "high")
        if executed:
            severity = apply_minimum(severity, "critical")
        elif restricted_attempt and "tool_scope_violation" in signals:
            severity = apply_minimum(severity, "critical")

        confidence, confidence_label = confidence_from_score(score, len(candidates))

        primary = [
            c.event_id
            for c in candidates
            if c.source_span_name in ("quarantine.route", "route.select") or c.signal_type == "tool_scope_violation"
        ]
        supporting = [
            c.event_id
            for c in candidates
            if c.event_id not in primary
            and c.source_span_name in ("policy.evaluate", "classify.threat", "escalation.evaluate")
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
                "Approve containment manifest for restricted tool calls and require human "
                "approval before any quarantine or escalation tooling executes"
            ),
            assessed_at=datetime.now(timezone.utc),
            policy_version=POLICY_VERSION,
            primary_evidence=primary,
            supporting_evidence=supporting,
            mitigating_evidence=mitigating_ids,
        )
