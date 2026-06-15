"""Full scenario catalog — implemented vs planned."""

from __future__ import annotations

from app.simulator.models import ScenarioConfig

IMPLEMENTED_SCENARIOS: dict[str, ScenarioConfig] = {
    "healthy_baseline": ScenarioConfig(
        id="healthy_baseline",
        eligible_archetypes=("decision", "retrieval_grounded", "document", "security_operations"),
        detection_phase=0,
        expected_incident=False,
        status="implemented",
    ),
    "unsupported_claim_spike": ScenarioConfig(
        id="unsupported_claim_spike",
        eligible_archetypes=("retrieval_grounded",),
        eligible_systems=("sys-agt-treasury-001",),
        detection_phase=1,
        expected_incident=True,
        status="implemented",
    ),
    "tool_scope_violation": ScenarioConfig(
        id="tool_scope_violation",
        eligible_archetypes=("security_operations",),
        eligible_systems=("sys-agt-phish-008",),
        detection_phase=1,
        expected_incident=True,
        status="implemented",
    ),
    "provider_latency_regression": ScenarioConfig(
        id="provider_latency_regression",
        eligible_archetypes=("security_operations",),
        eligible_systems=("sys-agt-cs-002",),
        detection_phase=1,
        expected_incident=True,
        status="implemented",
    ),
    "remediation_applied": ScenarioConfig(
        id="remediation_applied",
        eligible_archetypes=("decision", "retrieval_grounded", "document", "security_operations"),
        detection_phase=0,
        expected_incident=False,
        status="implemented",
    ),
}

PLANNED_SCENARIOS: dict[str, ScenarioConfig] = {
    "retrieval_degradation": ScenarioConfig(
        id="retrieval_degradation",
        eligible_archetypes=("retrieval_grounded",),
        detection_phase=2,
        status="planned",
    ),
    "missing_citation_fallback": ScenarioConfig(
        id="missing_citation_fallback",
        eligible_archetypes=("retrieval_grounded",),
        detection_phase=2,
        status="planned",
    ),
    "prompt_injection_attempt": ScenarioConfig(
        id="prompt_injection_attempt",
        eligible_archetypes=("security_operations",),
        detection_phase=2,
        status="planned",
    ),
    "sensitive_data_exposure": ScenarioConfig(
        id="sensitive_data_exposure",
        eligible_archetypes=("document", "retrieval_grounded"),
        detection_phase=2,
        status="planned",
    ),
    "model_version_drift": ScenarioConfig(
        id="model_version_drift",
        eligible_archetypes=("decision", "retrieval_grounded", "document", "security_operations"),
        detection_phase=2,
        status="planned",
    ),
    "missing_runtime_logging": ScenarioConfig(
        id="missing_runtime_logging",
        eligible_archetypes=("retrieval_grounded",),
        detection_phase=3,
        status="planned",
    ),
}

SCENARIO_REGISTRY = {
    **{k: f"implemented:{k}" for k in IMPLEMENTED_SCENARIOS},
    **{k: f"planned:{k}" for k in PLANNED_SCENARIOS},
}

PITCH_SEQUENCES = {
    "treasury_unsupported_claim": [
        ("healthy_baseline", {"count": 5}),
        ("unsupported_claim_spike", {"system_id": "sys-agt-treasury-001"}),
    ],
    "security_tool_scope": [
        ("healthy_baseline", {"count": 3}),
        ("tool_scope_violation", {"system_id": "sys-agt-phish-008"}),
    ],
    "cs_latency_regression": [
        ("healthy_baseline", {"count": 3}),
        ("provider_latency_regression", {"system_id": "sys-agt-cs-002"}),
    ],
    "treasury_full_governance": [
        ("healthy_baseline", {"count": 5}),
        ("unsupported_claim_spike", {"system_id": "sys-agt-treasury-001"}),
        ("remediation_applied", {"system_id": "sys-agt-treasury-001", "count": 5}),
    ],
}
