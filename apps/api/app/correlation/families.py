"""Diagnosis family definitions and correlation keys."""

from __future__ import annotations

# 15-minute window for diagnosis-family correlation (configurable per family later).
CORRELATION_WINDOW_MINUTES = 15

POLICY_VERSION = "2026.06.1"

OUTPUT_RELIABILITY = "output_reliability_control_degradation"
TOOL_GOVERNANCE = "prompt_injection_tool_governance_violation"
PLATFORM_RELIABILITY = "provider_degradation_routing_reliability"

DIAGNOSIS_LABELS = {
    OUTPUT_RELIABILITY: "Output reliability control degradation",
    TOOL_GOVERNANCE: "Prompt-injection-driven tool governance violation",
    PLATFORM_RELIABILITY: "Provider degradation affecting routing reliability",
}

SYSTEM_DIAGNOSIS: dict[str, str] = {
    "sys-agt-treasury-001": OUTPUT_RELIABILITY,
    "sys-agt-phish-008": TOOL_GOVERNANCE,
    "sys-agt-cs-002": PLATFORM_RELIABILITY,
}

OUTPUT_RELIABILITY_SIGNALS = frozenset(
    {
        "unsupported_claim_elevated",
        "grounding_degraded",
        "missing_citation_fallback",
        "citation_control_failure",
        "recurrence_detected",
    }
)

TOOL_GOVERNANCE_SIGNALS = frozenset(
    {
        "tool_scope_violation",
        "policy_denial",
        "hostile_input_detected",
        "restricted_tool_attempt",
    }
)

PLATFORM_RELIABILITY_SIGNALS = frozenset(
    {
        "latency_regression",
        "excessive_tool_retries",
        "fallback_invoked",
        "fallback_failed",
        "provider_error",
    }
)

SIGNAL_TO_FAMILY: dict[str, str] = {}
for sig in OUTPUT_RELIABILITY_SIGNALS:
    SIGNAL_TO_FAMILY[sig] = OUTPUT_RELIABILITY
for sig in TOOL_GOVERNANCE_SIGNALS:
    SIGNAL_TO_FAMILY[sig] = TOOL_GOVERNANCE
for sig in PLATFORM_RELIABILITY_SIGNALS:
    SIGNAL_TO_FAMILY[sig] = PLATFORM_RELIABILITY


def diagnosis_family_for(system_id: str, signal_type: str | None) -> str | None:
    if not signal_type:
        return None
    expected = SYSTEM_DIAGNOSIS.get(system_id)
    if expected:
        family_signals = {
            OUTPUT_RELIABILITY: OUTPUT_RELIABILITY_SIGNALS,
            TOOL_GOVERNANCE: TOOL_GOVERNANCE_SIGNALS,
            PLATFORM_RELIABILITY: PLATFORM_RELIABILITY_SIGNALS,
        }[expected]
        if signal_type in family_signals:
            return expected
        return None
    return SIGNAL_TO_FAMILY.get(signal_type)


def cluster_correlation_key(
    *,
    tenant_id: str,
    environment: str,
    system_id: str,
    diagnosis_family: str,
) -> str:
    return f"{tenant_id}:{environment}:{system_id}:{diagnosis_family}"


def infer_supporting_signal_type(event) -> str | None:
    """Map warning-level normalized events to supporting signal types."""
    signal = event.normalized_signal_type
    if signal:
        return signal
    evaluation = event.evaluation_signals or {}
    if evaluation.get("tool_scope_violation", 0) >= 1.0:
        return "tool_scope_violation"
    if event.policy_result == "deny" and event.operation_type == "tool_call":
        return "policy_denial"
    if float(evaluation.get("unsupported_claim_rate", 0)) > 0.02:
        return "unsupported_claim_elevated"
    if float(evaluation.get("grounding_score", 1.0)) < 0.7:
        return "grounding_degraded"
    if evaluation.get("missing_citation_fallback"):
        return "missing_citation_fallback"
    if evaluation.get("citation_verified") is False:
        return "citation_control_failure"
    if float(evaluation.get("operation_latency_ms") or evaluation.get("latency_ms") or 0) > 800:
        return "latency_regression"
    if float(evaluation.get("retry_count", 0)) >= 3:
        return "excessive_tool_retries"
    if evaluation.get("fallback_failed"):
        return "fallback_failed"
    if evaluation.get("fallback_invoked"):
        return "fallback_invoked"
    if evaluation.get("recurrence"):
        return "recurrence_detected"
    return None
