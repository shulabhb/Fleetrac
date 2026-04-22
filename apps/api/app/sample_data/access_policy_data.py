"""Per-system Access & Action Policy generator.

Each mock system gets a deterministic policy that governs what Fleetrac and
Bob can observe, prepare and execute on it. The policy shape is informed by
the system's regulatory sensitivity, environment and risk posture so the
resulting fleet reads like a realistic mix of customer governance postures
(some locked down, some permissive) rather than identical boilerplate.
"""

from __future__ import annotations

import hashlib
import random
from datetime import datetime, timezone

from app.sample_data.mock_data import MOCK_STORE
from app.schemas.actions import AccessPolicy


_SENSITIVITY_HIGH = {
    "high",
    "high_risk",
    "regulated",
    "restricted",
    "pii_sensitive",
    "financial",
    "compliance_sensitive",
}


def _rng(seed_key: str) -> random.Random:
    digest = hashlib.sha256(seed_key.encode("utf-8")).hexdigest()
    return random.Random(int(digest[:8], 16))


def _bob_mode(system) -> str:
    sens = (system.regulatory_sensitivity or "").lower()
    posture = system.risk_posture
    rng = _rng(f"mode::{system.id}")
    if sens in _SENSITIVITY_HIGH:
        return "recommend_only" if posture in ("critical", "at_risk") else rng.choice(
            ["recommend_only", "prepare_actions"]
        )
    if posture == "critical":
        return "approval_gated_execution"
    if posture == "at_risk":
        return rng.choice(["prepare_actions", "approval_gated_execution"])
    if posture == "watch":
        return rng.choice(["prepare_actions", "approval_gated_execution"])
    return rng.choice(["approval_gated_execution", "limited_auto_execution"])


def _telemetry_level(system) -> str:
    cov = system.telemetry_coverage or 0
    if cov >= 90:
        return "full"
    if cov >= 75:
        return "partial"
    rng = _rng(f"tel::{system.id}")
    return rng.choice(["metrics_only", "logs_only"])


def _config_access(system) -> str:
    sens = (system.regulatory_sensitivity or "").lower()
    if sens in _SENSITIVITY_HIGH:
        return "read_only"
    rng = _rng(f"cfg::{system.id}")
    return rng.choice(["read_only", "read_only", "read_write"])


def _logs_access(system) -> str:
    cov = system.telemetry_coverage or 0
    if cov >= 85:
        return "connected"
    if cov >= 70:
        return "partial"
    return "unavailable"


def _action_level(bob_mode: str) -> str:
    mapping = {
        "observe_only": "none",
        "recommend_only": "none",
        "prepare_actions": "prepare_only",
        "approval_gated_execution": "approval_gated",
        "limited_auto_execution": "limited_execution",
    }
    return mapping.get(bob_mode, "approval_gated")


def _observability_access(system) -> list[str]:
    cov = system.telemetry_coverage or 0
    items = [
        "Incident history",
        "Control fire history",
        "Governance activity",
        "Audit trail",
    ]
    if cov >= 75:
        items.insert(0, "Full telemetry stream")
    elif cov >= 50:
        items.insert(0, "Sampled telemetry stream")
    else:
        items.insert(0, "Metrics aggregates only")
    if (system.regulatory_sensitivity or "").lower() in _SENSITIVITY_HIGH:
        items.append("Deployment metadata (redacted)")
    else:
        items.append("Deployment metadata")
        items.append("Config metadata")
    return items


def _integration_access(system) -> list[str]:
    rng = _rng(f"integ::{system.id}")
    pool = [
        "Cloud logs connected",
        "Ticketing integration enabled",
        "Config metadata access",
        "Deployment registry (read-only)",
        "Workflow runner connected",
        "Control registry (read-only)",
    ]
    k = rng.randint(3, 5)
    selected = rng.sample(pool, k)
    selected.insert(0, f"Telemetry connector: {system.integration_mode or 'API gateway'}")
    return selected


def _approval_policy(system, bob_mode: str) -> list[str]:
    sens = (system.regulatory_sensitivity or "").lower()
    posture = system.risk_posture
    items: list[str] = []
    if bob_mode == "recommend_only":
        items.append("All Bob recommendations require human approval")
    elif bob_mode == "prepare_actions":
        items.append("Bob may prepare actions; execution requires human approval")
    elif bob_mode == "approval_gated_execution":
        items.append("Bob may execute only after explicit approval")
    elif bob_mode == "limited_auto_execution":
        items.append("Bob may auto-execute pre-approved low-risk actions")
    if sens in _SENSITIVITY_HIGH:
        items.append("Compliance Reviewer sign-off for policy-sensitive changes")
    if posture in ("critical", "at_risk"):
        items.append("Fleet Governor approval required for production changes")
    else:
        items.append("System Owner approval required for production changes")
    if bob_mode in ("approval_gated_execution", "limited_auto_execution"):
        items.append("Dual approval for rollback or traffic reroute")
    items.append("Low-risk administrative actions pre-approved (tickets, runbooks)")
    return items


def _allowed_actions(bob_mode: str, system) -> list[str]:
    sens = (system.regulatory_sensitivity or "").lower()
    base: list[str] = [
        "open_ticket",
        "create_followup_review",
        "draft_runbook",
        "assign_owner",
        "request_review",
        "schedule_monitoring_window",
    ]
    if bob_mode in (
        "prepare_actions",
        "approval_gated_execution",
        "limited_auto_execution",
    ):
        base.extend(
            [
                "prepare_threshold_change",
                "prepare_control_split",
                "prepare_config_suggestion",
                "prepare_review_gate_tightening",
            ]
        )
    if bob_mode in ("approval_gated_execution", "limited_auto_execution"):
        base.extend(
            [
                "prepare_routing_change",
                "prepare_fallback_activation",
                "request_emergency_review_path",
            ]
        )
    if bob_mode == "limited_auto_execution" and sens not in _SENSITIVITY_HIGH:
        # Only low-risk production writes are allowed under limited auto execution.
        base.append("prepare_auto_remediation_candidate")
    return base


def _restricted_actions(system, bob_mode: str) -> list[str]:
    sens = (system.regulatory_sensitivity or "").lower()
    items: list[str] = []
    if bob_mode in ("observe_only", "recommend_only"):
        items.append("No production writes")
    if sens in _SENSITIVITY_HIGH:
        items.append("No direct model pause without Compliance sign-off")
        items.append("No traffic reroute without dual approval")
    else:
        items.append("No traffic reroute without dual approval")
    items.append("No rollback execution without Fleet Governor approval")
    items.append("No destructive changes (drop/delete) under any mode")
    if system.environment == "production":
        items.append("No config writes bypassing change management")
    return items


def _execution_boundary(system, bob_mode: str) -> list[str]:
    items = [f"Scope: {system.use_case}"]
    if bob_mode in ("recommend_only", "observe_only"):
        items.append("No production writes")
    if bob_mode == "limited_auto_execution":
        items.append("Reversible changes only")
        items.append("Single-system blast radius")
    else:
        items.append("Single-system blast radius by default")
    if system.environment == "production":
        items.append("Production with approval gate")
    else:
        items.append("Staging / non-customer-facing only")
    return items


def _approvers(system, bob_mode: str) -> tuple[str, str | None]:
    sens = (system.regulatory_sensitivity or "").lower()
    posture = system.risk_posture
    if sens in _SENSITIVITY_HIGH:
        return ("Fleet Governor", "Compliance Reviewer")
    if posture in ("critical", "at_risk"):
        return ("Fleet Governor", "System Owner")
    if bob_mode == "recommend_only":
        return ("System Owner", "Control Owner")
    return ("System Owner", None)


def _environment(system) -> str:
    if system.environment == "staging":
        return "staging"
    return "production"


def build_policy(system, now: datetime) -> AccessPolicy:
    mode = _bob_mode(system)
    tel = _telemetry_level(system)
    cfg = _config_access(system)
    logs = _logs_access(system)
    action_level = _action_level(mode)
    primary, secondary = _approvers(system, mode)
    return AccessPolicy(
        system_id=system.id,
        bob_operating_mode=mode,  # type: ignore[arg-type]
        telemetry_level=tel,  # type: ignore[arg-type]
        config_access=cfg,  # type: ignore[arg-type]
        logs_access=logs,  # type: ignore[arg-type]
        action_level=action_level,  # type: ignore[arg-type]
        integration_mode=system.integration_mode or "API gateway",
        environment=_environment(system),  # type: ignore[arg-type]
        observability_access=_observability_access(system),
        integration_access=_integration_access(system),
        approval_policy=_approval_policy(system, mode),
        allowed_actions=_allowed_actions(mode, system),  # type: ignore[arg-type]
        restricted_actions=_restricted_actions(system, mode),
        execution_boundary=_execution_boundary(system, mode),
        primary_approver=primary,
        secondary_approver=secondary,
        updated_at=now,
    )


def generate_policy_store() -> dict[str, AccessPolicy]:
    now = datetime.now(timezone.utc)
    return {s.id: build_policy(s, now) for s in MOCK_STORE["systems"]}


POLICY_STORE: dict[str, AccessPolicy] = generate_policy_store()
