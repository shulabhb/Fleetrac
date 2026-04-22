"""Execution Console feed.

The console shows the visible operational acts Fleetrac / Bob have
performed or prepared — tickets opened, thresholds staged, rollbacks
prepared, routes shifted, maintenance windows toggled, owner handoffs.

Entries are derived from the Action store so the console reads as a
truthful record of what governed actions actually caused in the system,
not as an ambient fake log.
"""

from __future__ import annotations

import hashlib
import random
from datetime import datetime, timedelta, timezone

from app.sample_data.action_data import ACTION_STORE
from app.sample_data.operations_data import OPERATIONS_STORE
from app.schemas.operations import ExecutionConsoleEntry


def _rng(seed: str) -> random.Random:
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()
    return random.Random(int(digest[:8], 16))


_ACTION_LABELS: dict[str, tuple[str, str, str]] = {
    # action_type -> (action_code, action_label, default integration_id)
    "open_ticket": ("ticket.open", "Bob opened governance ticket", "int_jira"),
    "prepare_threshold_change": (
        "threshold.stage",
        "Bob staged threshold update",
        "int_internal_model_api",
    ),
    "prepare_control_split": (
        "control.split.prepare",
        "Bob prepared control split",
        "int_internal_model_api",
    ),
    "prepare_review_gate_tightening": (
        "review_gate.tighten.prepare",
        "Bob prepared review-gate tightening",
        "int_internal_model_api",
    ),
    "prepare_routing_change": (
        "routing.shift.prepare",
        "Bob prepared routing change to fallback",
        "int_internal_model_api",
    ),
    "prepare_config_suggestion": (
        "config.suggestion.prepare",
        "Bob prepared config change",
        "int_internal_model_api",
    ),
    "request_rollback": (
        "rollback.prepare",
        "Bob prepared rollback request",
        "int_mlflow",
    ),
    "request_emergency_review_path": (
        "review.emergency.open",
        "Bob opened emergency review path",
        "int_jira",
    ),
    "assign_owner": (
        "handoff.route",
        "Bob routed investigation to owner team",
        None,
    ),
    "schedule_monitoring_window": (
        "monitoring.schedule",
        "Bob scheduled monitoring window",
        None,
    ),
    "enable_maintenance_mode": (
        "maintenance.enable",
        "Bob toggled maintenance mode",
        "int_internal_model_api",
    ),
    "pause_workflow": (
        "workflow.pause",
        "Bob paused workflow variant",
        "int_argo",
    ),
    "trigger_diagnostic_run": (
        "diagnostic.run",
        "Bob triggered workflow diagnostic run",
        "int_airflow",
    ),
}


def _outcome_for(action) -> str:
    s = action.execution_status
    if s in ("drafted", "awaiting_approval"):
        return "prepared"
    if s in ("approved", "ready_to_execute"):
        return "staged"
    if s == "prepared":
        return "prepared"
    if s == "executed":
        return "executed"
    if s == "monitoring_outcome":
        return "executed"
    if s == "follow_up_required":
        return "executed"
    if s == "closed":
        return "executed"
    if s == "reverted":
        return "executed"
    if s == "rejected":
        return "blocked"
    return "acknowledged"


def _severity_for(action) -> str:
    if not action.allowed_by_policy:
        return "warn"
    if action.risk_level == "high":
        return "warn"
    if action.risk_level == "critical":
        return "error"
    return "info"


def _build_entry(action, rng: random.Random) -> ExecutionConsoleEntry:
    code, label, integration_id = _ACTION_LABELS.get(
        action.action_type,
        ("action.prepare", f"Bob prepared {action.action_type.replace('_', ' ')}", None),
    )
    ts = action.executed_at or action.updated_at or action.created_at
    outcome = "blocked" if not action.allowed_by_policy else _outcome_for(action)
    severity = _severity_for(action)
    if outcome == "blocked":
        severity = "warn"

    details_parts = [action.prepared_change_summary or action.title]
    if not action.allowed_by_policy and action.blocked_reason:
        details_parts.append(f"Blocked: {action.blocked_reason}")
    elif action.execution_mode == "manual_handoff":
        details_parts.append("Handoff package prepared for owner team.")
    elif action.execution_status == "executed":
        details_parts.append("Executed against target surface after approval.")
    elif action.execution_status in ("awaiting_approval", "approved", "ready_to_execute"):
        details_parts.append(f"Awaiting or cleared approval from {action.required_approver}.")

    integration_label = None
    if integration_id == "int_jira":
        integration_label = "Jira"
    elif integration_id == "int_mlflow":
        integration_label = "MLflow Registry"
    elif integration_id == "int_airflow":
        integration_label = "Apache Airflow"
    elif integration_id == "int_argo":
        integration_label = "Argo Workflows"
    elif integration_id == "int_internal_model_api":
        integration_label = "Internal Model APIs"

    return ExecutionConsoleEntry(
        id=f"ec_{action.id}",
        timestamp=ts,
        actor="Bob (Governance Copilot)",
        action_code=code,
        action_label=label,
        severity=severity,  # type: ignore[arg-type]
        target_system_id=action.target_system_id,
        target_system_name=action.target_system_name,
        action_id=action.id,
        investigation_id=action.bob_investigation_id,
        integration_id=integration_id,
        integration_label=integration_label,
        outcome=outcome,  # type: ignore[arg-type]
        details=" · ".join(details_parts),
    )


def generate_execution_console_store() -> dict[str, list[ExecutionConsoleEntry]]:
    rng = _rng("exec_console")
    entries: list[ExecutionConsoleEntry] = []
    for action in ACTION_STORE["actions"]:
        entries.append(_build_entry(action, rng))

    # A handful of fleet-level, non-action entries for color — maintenance
    # toggles, version sync, etc. Keep these sparse.
    now = datetime.now(timezone.utc)
    for ops in list(OPERATIONS_STORE.values())[:12]:
        if ops.maintenance.active:
            entries.append(
                ExecutionConsoleEntry(
                    id=f"ec_maint_{ops.system_id}",
                    timestamp=ops.maintenance.started_at or now,
                    actor="Fleetrac Operations",
                    action_code="maintenance.enable",
                    action_label="Maintenance window opened",
                    severity="notice",
                    target_system_id=ops.system_id,
                    target_system_name=None,
                    action_id=None,
                    investigation_id=None,
                    integration_id="int_internal_model_api",
                    integration_label="Internal Model APIs",
                    outcome="executed",
                    details=(
                        f"Maintenance window started. Reason: {ops.maintenance.reason or 'scheduled'}."
                    ),
                )
            )
        if ops.canary_active:
            entries.append(
                ExecutionConsoleEntry(
                    id=f"ec_canary_{ops.system_id}",
                    timestamp=ops.deployed_at,
                    actor="Release Engineering",
                    action_code="release.canary",
                    action_label="Canary release promoted",
                    severity="info",
                    target_system_id=ops.system_id,
                    target_system_name=None,
                    action_id=None,
                    investigation_id=None,
                    integration_id="int_mlflow",
                    integration_label="MLflow Registry",
                    outcome="executed",
                    details=(
                        f"Canary at {ops.canary_traffic_pct or 10:.0f}% on version {ops.current_version}."
                    ),
                )
            )

    entries.sort(key=lambda e: e.timestamp, reverse=True)
    return {"entries": entries}


EXECUTION_CONSOLE_STORE: dict[str, list[ExecutionConsoleEntry]] = generate_execution_console_store()
