"""Document-processing agent archetype."""

from __future__ import annotations

from app.fleet.registry import FleetSystem
from app.simulator.generators.base import ArchetypeGenerator


class DocumentAgentGenerator(ArchetypeGenerator):
    archetype = "document"

    def span_specs(self, system: FleetSystem, rng) -> list[dict]:
        return [
            {"name": "agent.request", "kind": "SERVER", "operation": "agent.request", "parent_index": None, "duration_ms": 20},
            {"name": "file.ingest", "kind": "INTERNAL", "operation": "file.ingest", "parent_index": 0, "duration_ms": 55},
            {"name": "format.validate", "kind": "INTERNAL", "operation": "format.validate", "parent_index": 0, "duration_ms": 40},
            {"name": "ocr.extract", "kind": "CLIENT", "operation": "model_call", "parent_index": 0, "duration_ms": rng.uniform(200, 350)},
            {"name": "field.validate", "kind": "INTERNAL", "operation": "field.validate", "parent_index": 0, "duration_ms": 45},
            {"name": "model.review", "kind": "CLIENT", "operation": "model_call", "parent_index": 0, "duration_ms": rng.uniform(150, 280)},
            {"name": "business.outcome", "kind": "INTERNAL", "operation": "business.outcome", "parent_index": 0, "duration_ms": 15},
        ]
