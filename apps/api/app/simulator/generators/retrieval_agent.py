"""Retrieval-grounded agent archetype."""

from __future__ import annotations

from app.fleet.registry import FleetSystem
from app.simulator.generators.base import ArchetypeGenerator
from app.simulator.span_templates import resolve_span_specs


class RetrievalAgentGenerator(ArchetypeGenerator):
    archetype = "retrieval_grounded"

    def span_specs(self, system: FleetSystem, rng) -> list[dict]:
        return resolve_span_specs(system.id, self.archetype, system, rng)
