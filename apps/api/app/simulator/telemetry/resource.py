"""OTEL resource and scope builders."""

from __future__ import annotations

from typing import Any

from app.fleet.registry import FleetSystem
from app.fleet.system_metadata import metadata_for


def build_resource_attributes(system: FleetSystem) -> dict[str, Any]:
    meta = metadata_for(system.id)
    service_slug = system.name.lower().replace(" ", "-")
    return {
        "service.name": service_slug,
        "service.namespace": "fleetrac-governed",
        "service.version": "2026.06.1",
        "deployment.environment.name": meta.get("environment", "production"),
        "cloud.provider": meta.get("cloud_provider", system.platform),
        "cloud.region": meta.get("cloud_region", "us-east-1"),
        "cloud.account.id": "111122223333",
        "process.runtime.name": "python",
        "telemetry.sdk.name": "fleetrac.agent-simulator",
        "telemetry.sdk.language": "python",
        "fleetrac.system.id": system.id,
        "fleetrac.system.archetype": meta.get("archetype", "decision"),
        "fleetrac.tenant.id": "tenant-demo",
        "fleetrac.data_sensitivity": meta.get("data_sensitivity", "internal"),
        "fleetrac.owner_team": system.owner_team,
    }


def build_instrumentation_scope() -> dict[str, Any]:
    return {
        "name": "fleetrac.agent-simulator",
        "version": "2026.06.1",
        "schema_url": "https://opentelemetry.io/schemas/1.27.0",
        "attributes": {},
    }
