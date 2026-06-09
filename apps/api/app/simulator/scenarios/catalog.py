SCENARIO_REGISTRY = {
    "unsupported_claim_spike": "app.simulator.scenarios.unsupported_claim_spike:unsupported_claim_spike_sequence",
    "tool_scope_violation": "app.simulator.scenarios.tool_scope_violation:tool_scope_violation_sequence",
    "remediation_applied": "app.simulator.scenarios.remediation_applied:remediation_applied_sequence",
}

PITCH_SEQUENCES = {
    "treasury_unsupported_claim": [
        ("healthy_baseline", {"count": 5}),
        ("unsupported_claim_spike", {"system_id": "sys-agt-treasury-001"}),
    ],
    "security_tool_scope": [
        ("healthy_baseline", {"count": 3}),
        ("tool_scope_violation", {"system_id": "sys-agt-cs-002"}),
    ],
    "treasury_full_governance": [
        ("healthy_baseline", {"count": 5}),
        ("unsupported_claim_spike", {"system_id": "sys-agt-treasury-001"}),
        ("remediation_applied", {"system_id": "sys-agt-treasury-001", "count": 5}),
    ],
}
