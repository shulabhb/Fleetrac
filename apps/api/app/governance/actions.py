from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.db.models import GovernedActionRow, Incident
from app.fleet.registry import SYSTEM_BY_ID
from app.governance.action_recommendations import recipe_for_incident
from app.governance.incidents import advance_lifecycle

# Open actions are reused. Terminal states do not block a later action,
# except Superseded rows which are historical duplicates and never primary.
_TERMINAL_STATUSES = {
    "Closed",
    "Rejected",
    "Rollback candidate",
    "Policy-blocked",
    "Superseded",
}


def _is_recipe_backed(action: GovernedActionRow) -> bool:
    title = action.title or ""
    return bool(action.expected_metric and action.expected_direction) and not title.startswith(
        "Remediate —"
    )


def _created_ts(action: GovernedActionRow) -> float:
    created = action.created_at
    if created is None:
        return 0.0
    return created.timestamp()


def _has_verification_result(action: GovernedActionRow) -> bool:
    text = (action.verification_status or "").lower()
    return any(
        token in text
        for token in ("improvement", "rollback", "no material", "regression", "follow")
    )


def _primary_rank(action: GovernedActionRow) -> tuple:
    """Lower sorts first. A recorded verification outranks a later not-started duplicate."""
    recipe = _is_recipe_backed(action)
    terminal = action.status in _TERMINAL_STATUSES
    verified = _has_verification_result(action)
    if action.status == "Superseded":
        tier = 5
    elif recipe and verified:
        tier = 0
    elif recipe and not terminal:
        tier = 1
    elif recipe and terminal:
        tier = 2
    elif not terminal:
        tier = 3
    else:
        tier = 4
    return (tier, -_created_ts(action))


def select_primary_action(actions: list[GovernedActionRow]) -> GovernedActionRow | None:
    visible = [row for row in actions if row.status != "Superseded"]
    pool = visible or list(actions)
    if not pool:
        return None
    return min(pool, key=_primary_rank)


def supersede_duplicate_actions(db: Session, incident_id: str | None = None) -> int:
    """Mark extra open/legacy rows Superseded. Rows stay in the table for audit."""
    q = db.query(GovernedActionRow)
    if incident_id:
        q = q.filter(GovernedActionRow.incident_id == incident_id)
    rows = q.all()
    grouped: dict[str, list[GovernedActionRow]] = {}
    for row in rows:
        grouped.setdefault(row.incident_id, []).append(row)

    changed = 0
    for group in grouped.values():
        if len(group) < 2:
            continue
        primary = select_primary_action(group)
        if primary is None:
            continue
        for row in group:
            if row.id == primary.id or row.status == "Superseded":
                continue
            # Keep a second recipe-backed terminal result (real verification history).
            if _is_recipe_backed(row) and row.status in _TERMINAL_STATUSES:
                continue
            row.status = "Superseded"
            row.verification_status = "Superseded"
            note = f"Superseded by {primary.id}."
            if note not in (row.recommended_action or ""):
                row.recommended_action = f"{row.recommended_action}\n{note}".strip()
            changed += 1
    if changed:
        db.flush()
    return changed


def ensure_action_for_incident(
    db: Session,
    incident: Incident,
    *,
    execution_mode: str = "approval_required",
) -> GovernedActionRow:
    """One open governed action per risk. Updates recipe fields while still awaiting approval."""
    supersede_duplicate_actions(db, incident.id)
    existing = (
        db.query(GovernedActionRow)
        .filter(GovernedActionRow.incident_id == incident.id)
        .order_by(GovernedActionRow.created_at.desc())
        .all()
    )
    primary = select_primary_action(existing)
    open_row = primary if primary is not None and primary.status not in _TERMINAL_STATUSES else None
    recipe = recipe_for_incident(incident)
    system = SYSTEM_BY_ID.get(incident.system_id)
    system_name = system.name_alias if system else incident.system_id

    if open_row is not None:
        # Fill recipe fields on legacy rows. Only rewrite the title while still awaiting approval
        # or when the row still has the generic pre-Phase-H title.
        if not open_row.expected_metric or open_row.status == "Awaiting approval":
            open_row.expected_metric = recipe.expected_metric
            open_row.expected_direction = recipe.expected_direction
            open_row.rollback_eligible = recipe.rollback_eligible
            open_row.expected_result = recipe.expected_result
            open_row.action_type = recipe.action_type or open_row.action_type
            open_row.severity = incident.severity
            open_row.owner_team = incident.owner_team
            generic = (open_row.title or "").startswith("Remediate —")
            if open_row.status == "Awaiting approval" or generic:
                open_row.title = recipe.title
                open_row.recommended_action = recipe.summary
        return open_row

    if primary is not None:
        # A verified or otherwise terminal primary already exists — do not open a duplicate.
        return primary

    action_id = f"act_{incident.alias_id}_{uuid.uuid4().hex[:8]}"
    row = GovernedActionRow(
        id=action_id,
        incident_id=incident.id,
        alias_id=incident.alias_id,
        title=recipe.title,
        owner_team=incident.owner_team,
        system_id=incident.system_id,
        system_name=system_name,
        risk_category=incident.classification_category,
        severity=incident.severity,
        execution_mode=execution_mode,
        status="Awaiting approval",
        verification_status="Not started",
        recommended_action=recipe.summary,
        action_type=recipe.action_type,
        expected_metric=recipe.expected_metric,
        expected_direction=recipe.expected_direction,
        rollback_eligible=recipe.rollback_eligible,
        expected_result=recipe.expected_result,
    )
    db.add(row)
    db.flush()
    return row


def create_action_from_incident(
    db: Session,
    incident: Incident,
    *,
    execution_mode: str = "approval_required",
) -> GovernedActionRow:
    """Compatibility wrapper — dedupes onto the open action for this risk."""
    row = ensure_action_for_incident(db, incident, execution_mode=execution_mode)
    if row.execution_mode != execution_mode and row.status == "Awaiting approval":
        row.execution_mode = execution_mode
    return row


def list_actions(
    db: Session,
    *,
    status: str | None = None,
    include_history: bool = False,
) -> list[GovernedActionRow]:
    supersede_duplicate_actions(db)
    q = db.query(GovernedActionRow).order_by(GovernedActionRow.created_at.desc())
    if status:
        q = q.filter(GovernedActionRow.status == status)
    elif not include_history:
        q = q.filter(GovernedActionRow.status != "Superseded")
    rows = q.all()
    if include_history or status:
        return rows
    # One primary card per incident for the default Action Center list.
    grouped: dict[str, list[GovernedActionRow]] = {}
    for row in rows:
        grouped.setdefault(row.incident_id, []).append(row)
    primary = [picked for group in grouped.values() if (picked := select_primary_action(group))]
    primary.sort(key=lambda row: _created_ts(row), reverse=True)
    return primary


def get_action(db: Session, action_id: str) -> GovernedActionRow | None:
    return db.get(GovernedActionRow, action_id)


def approve_action(db: Session, action: GovernedActionRow) -> GovernedActionRow:
    from app.governance.notifications import sync_current_notification

    action.status = "Approved"
    action.verification_status = "Monitoring"
    inc = db.get(Incident, action.incident_id)
    if inc:
        advance_lifecycle(db, inc, "Remediation", note="Governed action approved")
        sync_current_notification(db, inc, trigger="derive")
    return action


def reject_action(db: Session, action: GovernedActionRow) -> GovernedActionRow:
    action.status = "Rejected"
    action.verification_status = "Not started"
    return action
