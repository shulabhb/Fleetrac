from __future__ import annotations

from typing import Any

from app.fleet.registry import SYSTEM_BY_ID
from app.schemas.analysis import FleetracAnalysis
from app.fleet.registry import incident_alias


def build_analysis_template(
    incident_id: str,
    *,
    system_id: str,
    signal_type: str,
    metric_value: float,
) -> dict:
    system = SYSTEM_BY_ID.get(system_id)
    name = system.name if system else system_id
    alias = incident_alias(system_id, signal_type)

    templates: dict[str, dict[str, Any]] = {
        "unsupported_claim_elevated": {
            "summary": (
                f"Bounded Fleetrac Analysis for {name}: unsupported claim rate "
                f"{metric_value:.2%} exceeded policy threshold."
            ),
            "recommended_actions": [
                "Confirm grounding sources for flagged spans",
                "Validate citation coverage against approved data feeds",
                "Hold release until Model Risk Management sign-off",
            ],
            "evidence_highlights": [
                "Evaluation span with elevated unsupported_claim_rate",
                "Retrieval confidence degradation preceding output evaluation",
            ],
            "policy_notes": "Output Reliability control; approval-gated path only.",
            "confidence": min(0.95, 0.6 + metric_value),
        },
        "tool_scope_violation": {
            "summary": (
                f"Agent attempted tool invocation outside approved policy scope on {name}."
            ),
            "recommended_actions": [
                "Approve containment manifest for restricted tool calls",
                "Require human approval for refund tooling above threshold",
            ],
            "evidence_highlights": [
                "Policy engine denial on tool_call span",
                "Trace correlation across orchestration steps",
            ],
            "policy_notes": "Cyber risk containment; approval required before disable.",
            "confidence": 0.88,
        },
        "retrieval_degradation": {
            "summary": f"Retrieval failure rate elevated on {name}.",
            "recommended_actions": [
                "Increase monitoring on retrieval path",
                "Apply pre-approved fallback retrieval route",
            ],
            "evidence_highlights": ["Retrieval monitor breach", "Latency correlation"],
            "policy_notes": "Technology risk; auto-in-scope monitoring allowed.",
            "confidence": 0.72,
        },
        "latency_regression": {
            "summary": f"Provider latency regression detected on {name}.",
            "recommended_actions": [
                "Review provider routing configuration",
                "Prepare rollback candidate if SLO breach persists",
            ],
            "evidence_highlights": ["P95 latency above baseline", "Provider invocation logs"],
            "policy_notes": "Platform reliability review recommended.",
            "confidence": 0.8,
        },
    }

    tpl = templates.get(
        signal_type,
        {
            "summary": f"Governance signal {signal_type} detected on {name}.",
            "recommended_actions": ["Review packaged evidence with owner team"],
            "evidence_highlights": [f"Signal type: {signal_type}"],
            "policy_notes": "Bounded analysis from ingested telemetry metadata.",
            "confidence": 0.65,
        },
    )

    analysis = FleetracAnalysis(
        incident_id=incident_id,
        alias_id=alias,
        summary=tpl["summary"],
        bounded_scope=(
            "Analysis is limited to telemetry metadata, evaluation signals, and packaged "
            "evidence references. No autonomous remediation is proposed."
        ),
        recommended_actions=tpl["recommended_actions"],
        evidence_highlights=tpl["evidence_highlights"],
        policy_notes=tpl["policy_notes"],
        confidence=tpl["confidence"],
    )
    return analysis.model_dump()
