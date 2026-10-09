"""Deterministic flagship story definitions for continuous scenario windows.

Maps product story ids → existing pitch mutations / systems / verification paths.
Does not replace PITCH_SEQUENCES — extends continuous injection.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ScenarioStory:
    id: str
    system_id: str
    mutation_id: str  # existing apply_scenario_mutation id
    pitch_alias: str
    expected_verification: str  # improvement_observed | rollback_candidate | no_material_change
    description: str
    # Soft-degradation metric nudge (under threshold) before incident_window
    soft_mutation_id: str = "soft_degradation"


SCENARIO_STORIES: dict[str, ScenarioStory] = {
    "treasury_grounding_or_model_risk_issue": ScenarioStory(
        id="treasury_grounding_or_model_risk_issue",
        system_id="sys-agt-treasury-001",
        mutation_id="unsupported_claim_spike",
        pitch_alias="inc-mrm-001",
        expected_verification="improvement_observed",
        description="Treasury output reliability — unsupported claim / grounding breach",
    ),
    "phishing_security_anomaly": ScenarioStory(
        id="phishing_security_anomaly",
        system_id="sys-agt-phish-008",
        mutation_id="tool_scope_violation",
        pitch_alias="inc-sec-001",
        expected_verification="rollback_candidate",
        description="Phishing tool-governance violation — high blast-radius containment",
    ),
    "platform_or_tool_degradation": ScenarioStory(
        id="platform_or_tool_degradation",
        system_id="sys-agt-cs-002",
        mutation_id="provider_latency_regression",
        pitch_alias="inc-plat-003",
        expected_verification="no_material_change",
        description="CS provider latency / routing reliability — follow-up monitoring",
    ),
    # Aliases matching existing pitch endpoint ids
    "treasury_unsupported_claim": ScenarioStory(
        id="treasury_unsupported_claim",
        system_id="sys-agt-treasury-001",
        mutation_id="unsupported_claim_spike",
        pitch_alias="inc-mrm-001",
        expected_verification="improvement_observed",
        description="Pitch alias for treasury unsupported claim",
    ),
    "security_tool_scope": ScenarioStory(
        id="security_tool_scope",
        system_id="sys-agt-phish-008",
        mutation_id="tool_scope_violation",
        pitch_alias="inc-sec-001",
        expected_verification="rollback_candidate",
        description="Pitch alias for phishing tool scope",
    ),
    "cs_latency_regression": ScenarioStory(
        id="cs_latency_regression",
        system_id="sys-agt-cs-002",
        mutation_id="provider_latency_regression",
        pitch_alias="inc-plat-003",
        expected_verification="no_material_change",
        description="Pitch alias for CS latency regression",
    ),
}

# Continuous runner lifecycle phases (story-shaped, not random)
STORY_PHASES: tuple[str, ...] = (
    "baseline",
    "degradation",
    "incident_window",
    "post_action_verification",
    "recovery",
    "regression",
)


def resolve_story(story_id: str) -> ScenarioStory | None:
    return SCENARIO_STORIES.get(story_id)
