"""Environment configuration (production, staging, sandbox, internal_only)."""

from __future__ import annotations

from app.sample_data.mock_data import MOCK_STORE
from app.schemas.operations import EnvironmentConfig


def _system_count_for(kind: str) -> int:
    systems = MOCK_STORE["systems"]
    # Only production/staging exist on the underlying dataset; sandbox and
    # internal_only are mocked with small allocations for realism.
    if kind == "production":
        return sum(1 for s in systems if s.environment == "production")
    if kind == "staging":
        return sum(1 for s in systems if s.environment == "staging")
    if kind == "sandbox":
        return max(2, len(systems) // 14)
    if kind == "internal_only":
        return max(1, len(systems) // 18)
    return 0


ENVIRONMENTS: list[EnvironmentConfig] = [
    EnvironmentConfig(
        id="env_production",
        label="Production",
        kind="production",
        description=(
            "Customer-facing production surface. Bob is approval-gated; "
            "rollback requires dual approval; threshold tuning must be prepared, never auto-applied."
        ),
        default_bob_mode="approval_gated_execution",
        approval_policy_label="Dual approval on regulated surfaces",
        auto_execute_low_risk=False,
        maintenance_suppresses_alerts=True,
        bob_allowed_during_maintenance=False,
        rollback_requires_dual_approval=True,
        threshold_tuning_pre_approved=False,
        ticket_creation_always_allowed=True,
        system_count=_system_count_for("production"),
    ),
    EnvironmentConfig(
        id="env_staging",
        label="Staging",
        kind="staging",
        description=(
            "Pre-production. Prepared actions may execute with a single approver. "
            "Threshold tuning is pre-approved to support rapid validation."
        ),
        default_bob_mode="approval_gated_execution",
        approval_policy_label="Single approver on prepared actions",
        auto_execute_low_risk=False,
        maintenance_suppresses_alerts=True,
        bob_allowed_during_maintenance=True,
        rollback_requires_dual_approval=False,
        threshold_tuning_pre_approved=True,
        ticket_creation_always_allowed=True,
        system_count=_system_count_for("staging"),
    ),
    EnvironmentConfig(
        id="env_sandbox",
        label="Sandbox",
        kind="sandbox",
        description=(
            "Experimentation surface. Safe auto-execution is allowed for low-risk, reversible actions."
        ),
        default_bob_mode="limited_auto_execution",
        approval_policy_label="Auto for low-risk, reversible",
        auto_execute_low_risk=True,
        maintenance_suppresses_alerts=True,
        bob_allowed_during_maintenance=True,
        rollback_requires_dual_approval=False,
        threshold_tuning_pre_approved=True,
        ticket_creation_always_allowed=True,
        system_count=_system_count_for("sandbox"),
    ),
    EnvironmentConfig(
        id="env_internal_only",
        label="Internal Only",
        kind="internal_only",
        description=(
            "Internal evaluation surface. Bob observes and recommends only. Nothing executes against these systems."
        ),
        default_bob_mode="recommend_only",
        approval_policy_label="Observation + recommendation only",
        auto_execute_low_risk=False,
        maintenance_suppresses_alerts=True,
        bob_allowed_during_maintenance=True,
        rollback_requires_dual_approval=False,
        threshold_tuning_pre_approved=False,
        ticket_creation_always_allowed=True,
        system_count=_system_count_for("internal_only"),
    ),
]
