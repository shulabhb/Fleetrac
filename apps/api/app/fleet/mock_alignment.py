"""Align System Registry mock rows with fleet simulator IDs and model codes."""

from __future__ import annotations

from app.fleet.registry import SYSTEM_BY_ID
from app.simulator.system_profiles import LEGACY_SYSTEM_ID_TO_FLEET, profile_for
from app.schemas.entities import Incident, System, TelemetryEvent


def _fleet_system_entity(fleet_id: str, template: System | None = None) -> System:
    fleet = SYSTEM_BY_ID[fleet_id]
    profile = profile_for(fleet_id)
    base = template.model_dump() if template else {}
    return System(
        id=fleet_id,
        name=f"{profile.model_code} - {profile.use_case}",
        owner=fleet.owner_team,
        environment=base.get("environment", "production"),
        model=profile.model_code,
        model_type=profile.model_type_label,
        use_case=profile.use_case,
        telemetry_archetype=base.get("telemetry_archetype", "agentic_workflow"),
        business_function=base.get("business_function", fleet.name),
        deployment_scope=base.get("deployment_scope", "internal"),
        regulatory_sensitivity=base.get("regulatory_sensitivity", "high_regulated"),
        control_owner=fleet.team_lead,
        risk_posture=base.get("risk_posture", "healthy"),
        hosting_environment=fleet.platform,
        integration_mode=base.get("integration_mode", "connected"),
        telemetry_coverage=base.get("telemetry_coverage", 0.95),
        connection_status=base.get("connection_status", "connected"),
    )


def align_mock_store(store: dict) -> dict:
    """Replace legacy sys_m* rows with sys-agt-* fleet IDs; add agent-only fleet systems."""
    id_map = dict(LEGACY_SYSTEM_ID_TO_FLEET)
    systems_by_old: dict[str, System] = {s.id: s for s in store["systems"]}

    remapped_systems: list[System] = []
    consumed_fleet: set[str] = set()

    for system in store["systems"]:
        fleet_id = id_map.get(system.id)
        if fleet_id:
            if fleet_id in consumed_fleet:
                continue
            remapped_systems.append(_fleet_system_entity(fleet_id, system))
            consumed_fleet.add(fleet_id)
        elif system.id not in id_map.values():
            remapped_systems.append(system)

    for fleet_id in SYSTEM_BY_ID:
        if fleet_id not in consumed_fleet:
            remapped_systems.append(_fleet_system_entity(fleet_id))

    reverse_map = {old: new for old, new in id_map.items()}

    def remap_id(value: str) -> str:
        return reverse_map.get(value, value)

    telemetry: list[TelemetryEvent] = []
    for event in store["telemetry_events"]:
        telemetry.append(
            event.model_copy(
                update={
                    "system_id": remap_id(event.system_id),
                    "model_name": profile_for(remap_id(event.system_id)).model_code
                    if remap_id(event.system_id) in SYSTEM_BY_ID
                    else event.model_name,
                }
            )
        )

    incidents: list[Incident] = []
    for incident in store["incidents"]:
        new_system_id = remap_id(incident.system_id)
        profile = profile_for(new_system_id) if new_system_id in SYSTEM_BY_ID else None
        incidents.append(
            incident.model_copy(
                update={
                    "system_id": new_system_id,
                    "system_name": (
                        f"{profile.use_case} ({profile.model_code})"
                        if profile
                        else incident.system_name
                    ),
                }
            )
        )

    return {
        **store,
        "systems": remapped_systems,
        "telemetry_events": telemetry,
        "incidents": incidents,
    }
