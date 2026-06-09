from __future__ import annotations

from sqlalchemy.orm import Session

from app.db.models import DetectionRule, SimulatorState, System
from app.fleet.registry import FLEET_SYSTEMS, RULE_SPECS


RUNTIME_TABLES = (
    "raw_events",
    "normalized_events",
    "incidents",
    "evidence_records",
    "evidence_items",
    "fleetrac_analysis",
    "notifications",
    "assignments",
    "governed_actions",
    "verification_outcomes",
)


def seed_config(db: Session) -> None:
    for spec in FLEET_SYSTEMS:
        if db.get(System, spec.id) is None:
            db.add(
                System(
                    id=spec.id,
                    display_id=spec.display_id,
                    name=spec.name,
                    name_alias=spec.name_alias,
                    owner_team=spec.owner_team,
                    team_lead=spec.team_lead,
                    default_reviewer=spec.default_reviewer,
                    baseline_metrics=dict(spec.baseline_metrics),
                    applicable_control_ids=list(spec.applicable_control_ids),
                )
            )

    for rule in RULE_SPECS:
        if db.get(DetectionRule, rule.id) is None:
            db.add(
                DetectionRule(
                    id=rule.id,
                    signal_type=rule.signal_type,
                    threshold_field=rule.threshold_field,
                    threshold_operator=rule.threshold_operator,
                    threshold_value=rule.threshold_value,
                    severity=rule.severity,
                    enabled=True,
                )
            )

    state = db.get(SimulatorState, 1)
    if state is None:
        db.add(
            SimulatorState(
                id=1,
                running=False,
                event_count=0,
                mode="idle",
                rate_eps=5.0,
            )
        )
    db.commit()


def truncate_runtime(db: Session) -> None:
    from sqlalchemy import text

    for table in RUNTIME_TABLES:
        db.execute(text(f"DELETE FROM {table}"))
    state = db.get(SimulatorState, 1)
    if state:
        state.running = False
        state.last_scenario = None
        state.event_count = 0
        state.incident_id = None
        state.last_error = None
        state.mode = "idle"
        state.pitch_step = 0
    db.commit()


def reset_to_seed(db: Session) -> None:
    truncate_runtime(db)
    seed_config(db)
