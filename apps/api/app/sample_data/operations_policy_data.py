"""Fleet-wide default governance / action policies."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.schemas.operations import OperationsPolicy


def _ts(days_ago: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days_ago)


OPERATIONS_POLICIES: list[OperationsPolicy] = [
    OperationsPolicy(
        id="pol_bob_default_mode",
        label="Default Bob operating mode",
        description="Mode applied to any new system unless overridden by system- or environment-specific policy.",
        category="bob_defaults",
        current_value="approval_gated_execution",
        allowed_values=[
            "observe_only",
            "recommend_only",
            "prepare_actions",
            "approval_gated_execution",
            "limited_auto_execution",
        ],
        scope="fleet",
        last_changed_by="AI Governance Office",
        last_changed_at=_ts(21),
    ),
    OperationsPolicy(
        id="pol_default_approval_policy",
        label="Default approval policy",
        description="Baseline approval requirement for Bob-prepared changes.",
        category="approvals",
        current_value="single_approver",
        allowed_values=["no_approval", "single_approver", "dual_approval"],
        scope="fleet",
        last_changed_by="AI Governance Office",
        last_changed_at=_ts(42),
    ),
    OperationsPolicy(
        id="pol_regulated_approval_policy",
        label="Approval policy on regulated surfaces",
        description="Approval requirement when the target system handles regulated or PII-sensitive workloads.",
        category="approvals",
        current_value="dual_approval",
        allowed_values=["single_approver", "dual_approval"],
        scope="regulated_systems",
        last_changed_by="Compliance Review Board",
        last_changed_at=_ts(12),
    ),
    OperationsPolicy(
        id="pol_auto_exec_low_risk",
        label="Auto-execute low-risk, reversible actions",
        description="Whether Bob may auto-execute low-risk reversible actions without an approver in sandbox.",
        category="execution",
        current_value="sandbox_only",
        allowed_values=["never", "sandbox_only", "staging_and_sandbox"],
        scope="by_environment",
        last_changed_by="Platform Reliability",
        last_changed_at=_ts(8),
    ),
    OperationsPolicy(
        id="pol_maintenance_suppresses_noise",
        label="Maintenance suppresses incident noise",
        description="Whether incidents generated inside an approved maintenance window are suppressed from the reviewer queue.",
        category="maintenance",
        current_value="enabled",
        allowed_values=["enabled", "disabled"],
        scope="fleet",
        last_changed_by="AI Governance Office",
        last_changed_at=_ts(60),
    ),
    OperationsPolicy(
        id="pol_bob_during_maintenance",
        label="Bob allowed to act during maintenance",
        description="Whether Bob may prepare or execute actions while a system is in maintenance mode.",
        category="maintenance",
        current_value="prepare_only",
        allowed_values=["blocked", "prepare_only", "allowed"],
        scope="fleet",
        last_changed_by="AI Governance Office",
        last_changed_at=_ts(28),
    ),
    OperationsPolicy(
        id="pol_rollback_dual_approval",
        label="Rollback requires dual approval",
        description="Whether rollbacks on production require dual approval before execution.",
        category="rollback",
        current_value="production_only",
        allowed_values=["always", "production_only", "never"],
        scope="by_environment",
        last_changed_by="Compliance Review Board",
        last_changed_at=_ts(15),
    ),
    OperationsPolicy(
        id="pol_threshold_tuning_scope",
        label="Threshold tuning pre-approval scope",
        description="Environments where threshold tuning is pre-approved (no human approval gate on preparation).",
        category="execution",
        current_value="staging_and_sandbox",
        allowed_values=["none", "sandbox_only", "staging_and_sandbox"],
        scope="by_environment",
        last_changed_by="Model Risk Engineering",
        last_changed_at=_ts(7),
    ),
    OperationsPolicy(
        id="pol_ticket_creation",
        label="Governance ticket creation",
        description="Whether Bob may always open a governance ticket via the approved Jira template.",
        category="execution",
        current_value="always_allowed",
        allowed_values=["always_allowed", "approval_gated", "disabled"],
        scope="fleet",
        last_changed_by="AI Governance Office",
        last_changed_at=_ts(90),
    ),
    OperationsPolicy(
        id="pol_audit_floor",
        label="Audit coverage floor",
        description="Minimum acceptable audit coverage before the governance floor breach control is triggered.",
        category="audit",
        current_value="95%",
        allowed_values=["90%", "95%", "97%", "99%"],
        scope="fleet",
        last_changed_by="AI Governance Office",
        last_changed_at=_ts(120),
    ),
]
