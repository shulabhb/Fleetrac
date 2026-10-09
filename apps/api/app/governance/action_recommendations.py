"""Deterministic governed-action recipes. No LLM."""

from __future__ import annotations

from dataclasses import dataclass

from app.db.models import Incident


@dataclass(frozen=True)
class ActionRecipe:
    title: str
    summary: str
    expected_metric: str
    expected_direction: str  # decrease | increase
    rollback_eligible: bool
    expected_result: str
    action_type: str = "governed_remediation"


_BY_ALIAS: dict[str, ActionRecipe] = {
    "inc-mrm-001": ActionRecipe(
        title="Tighten Treasury grounding and review unsupported-claim guardrail",
        summary=(
            "Review Treasury commentary grounding. Expect unsupported_claim_rate to decrease "
            "below the 0.03 threshold after the guardrail change. Review-only; not a production rollback."
        ),
        expected_metric="unsupported_claim_rate",
        expected_direction="decrease",
        rollback_eligible=False,
        expected_result="improvement_observed",
    ),
    "inc-sec-001": ActionRecipe(
        title="Rollback security tool-scope change and review escalation boundary",
        summary=(
            "Contain phishing tool-scope blast radius. Expect security anomaly / tool-scope "
            "signals to fall. Rollback is eligible if the violation persists or widens."
        ),
        expected_metric="tool_scope_violation",
        expected_direction="decrease",
        rollback_eligible=True,
        expected_result="rollback_candidate",
    ),
    "inc-plat-003": ActionRecipe(
        title="Review platform/tool degradation and verify latency recovery",
        summary=(
            "Monitor Customer Support routing latency after fallback. Expect latency_ms to decrease. "
            "Ambiguous movement is follow-up / no material change, not an automatic close."
        ),
        expected_metric="latency_ms",
        expected_direction="decrease",
        rollback_eligible=True,
        expected_result="no_material_change",
    ),
}

_BY_SIGNAL: dict[str, ActionRecipe] = {
    "unsupported_claim_elevated": _BY_ALIAS["inc-mrm-001"],
    "grounding_degraded": ActionRecipe(
        title="Review grounding threshold and citation coverage",
        summary="Expect grounding_score to increase above the minimum after source review.",
        expected_metric="grounding_score",
        expected_direction="increase",
        rollback_eligible=False,
        expected_result="improvement_observed",
    ),
    "tool_scope_violation": _BY_ALIAS["inc-sec-001"],
    "latency_regression": _BY_ALIAS["inc-plat-003"],
    "retrieval_degradation": ActionRecipe(
        title="Review retrieval degradation and verify source freshness",
        summary="Expect retrieval failure rate to decrease. Unclear recovery is follow-up.",
        expected_metric="retrieval_failure_rate",
        expected_direction="decrease",
        rollback_eligible=False,
        expected_result="no_material_change",
    ),
}


def recipe_for_incident(incident: Incident) -> ActionRecipe:
    if incident.alias_id and incident.alias_id in _BY_ALIAS:
        return _BY_ALIAS[incident.alias_id]
    if incident.signal_type in _BY_SIGNAL:
        return _BY_SIGNAL[incident.signal_type]
    metric = incident.metric_name or "governance_metric"
    direction = "increase" if (incident.threshold_operator or "") in ("<", "<=") else "decrease"
    return ActionRecipe(
        title=f"Review governed control — {incident.title}",
        summary=incident.recommended_next_step
        or "Review Risk Detail, then approve a bounded action and verify impact.",
        expected_metric=metric,
        expected_direction=direction,
        rollback_eligible=False,
        expected_result="no_material_change",
    )
