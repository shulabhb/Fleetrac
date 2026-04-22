"""Service accessors for the Operations & Impact layer."""

from __future__ import annotations

from app.sample_data.changes_data import CHANGES_STORE
from app.sample_data.connector_status_data import CONNECTOR_STATUS
from app.sample_data.environments_data import ENVIRONMENTS
from app.sample_data.execution_console_data import EXECUTION_CONSOLE_STORE
from app.sample_data.integrations_data import INTEGRATIONS
from app.sample_data.operations_data import OPERATIONS_STORE
from app.sample_data.operations_policy_data import OPERATIONS_POLICIES
from app.schemas.operations import (
    BobImpactSummary,
    Change,
    ConnectorStatus,
    EnvironmentConfig,
    ExecutionConsoleEntry,
    Integration,
    OperationsPolicy,
    SystemOperations,
)


def list_operations() -> list[SystemOperations]:
    return list(OPERATIONS_STORE.values())


def get_operations(system_id: str) -> SystemOperations | None:
    return OPERATIONS_STORE.get(system_id)


def list_integrations() -> list[Integration]:
    return INTEGRATIONS


def list_environments() -> list[EnvironmentConfig]:
    return ENVIRONMENTS


def list_operations_policies() -> list[OperationsPolicy]:
    return OPERATIONS_POLICIES


def list_connector_status() -> list[ConnectorStatus]:
    return CONNECTOR_STATUS


def list_execution_console(
    *,
    target_system_id: str | None = None,
    action_id: str | None = None,
    investigation_id: str | None = None,
    integration_id: str | None = None,
    limit: int | None = None,
) -> list[ExecutionConsoleEntry]:
    items = EXECUTION_CONSOLE_STORE["entries"]
    if target_system_id:
        items = [e for e in items if e.target_system_id == target_system_id]
    if action_id:
        items = [e for e in items if e.action_id == action_id]
    if investigation_id:
        items = [e for e in items if e.investigation_id == investigation_id]
    if integration_id:
        items = [e for e in items if e.integration_id == integration_id]
    if limit is not None:
        items = items[:limit]
    return items


def list_changes(
    *,
    target_system_id: str | None = None,
    source_action_id: str | None = None,
    source_investigation_id: str | None = None,
    source_incident_id: str | None = None,
    impact_status: str | None = None,
    limit: int | None = None,
) -> list[Change]:
    items = CHANGES_STORE["changes"]
    if target_system_id:
        items = [c for c in items if c.target_system_id == target_system_id]
    if source_action_id:
        items = [c for c in items if c.source_action_id == source_action_id]
    if source_investigation_id:
        items = [c for c in items if c.source_investigation_id == source_investigation_id]
    if source_incident_id:
        items = [c for c in items if c.source_incident_id == source_incident_id]
    if impact_status:
        items = [c for c in items if c.impact_status == impact_status]
    if limit is not None:
        items = items[:limit]
    return items


def get_change(change_id: str) -> Change | None:
    return next((c for c in CHANGES_STORE["changes"] if c.id == change_id), None)


def get_change_by_action(action_id: str) -> Change | None:
    return next(
        (c for c in CHANGES_STORE["changes"] if c.source_action_id == action_id),
        None,
    )


def bob_impact_summary(window_label: str = "Last 30 days") -> BobImpactSummary:
    changes = CHANGES_STORE["changes"]
    actions_executed = sum(1 for c in changes if c.impact_status not in ("proposed", "approved"))
    improvements = sum(1 for c in changes if c.impact_status == "improvement_observed")
    no_change = sum(1 for c in changes if c.impact_status == "no_material_change")
    regressions = sum(1 for c in changes if c.impact_status == "regression_detected")
    rollbacks = sum(1 for c in changes if c.impact_status == "rollback_candidate")

    recurrence_reduced = 0
    reviewer_burden_reduced = 0
    for c in changes:
        if c.recurrence_before is not None and c.recurrence_after is not None:
            recurrence_reduced += max(0, c.recurrence_before - c.recurrence_after)
        if c.reviewer_burden_before is not None and c.reviewer_burden_after is not None:
            reviewer_burden_reduced += max(0, c.reviewer_burden_before - c.reviewer_burden_after)

    control_fires_reduced = sum(
        1
        for c in changes
        if c.impact_status in ("improvement_observed", "closed")
        and any(m.label.lower().startswith("control fire") for m in c.metric_deltas)
    )

    return BobImpactSummary(
        window_label=window_label,
        actions_executed=actions_executed,
        improvements_observed=improvements,
        no_material_change=no_change,
        regressions_detected=regressions,
        rollback_candidates=rollbacks,
        recurrence_reduced=recurrence_reduced,
        reviewer_burden_reduced=reviewer_burden_reduced,
        control_fires_reduced=control_fires_reduced,
    )
