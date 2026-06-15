"""Decision agent archetype — refund, PEP, access review."""

from __future__ import annotations

from app.fleet.registry import FleetSystem
from app.simulator.generators.base import ArchetypeGenerator


class DecisionAgentGenerator(ArchetypeGenerator):
    archetype = "decision"

    def span_specs(self, system: FleetSystem, rng) -> list[dict]:
        return [
            {"name": "agent.request", "kind": "SERVER", "operation": "agent.request", "parent_index": None, "duration_ms": 20},
            {"name": "input.classify", "kind": "INTERNAL", "operation": "input.classify", "parent_index": 0, "duration_ms": 45},
            {"name": "identity.lookup", "kind": "CLIENT", "operation": "identity.lookup", "parent_index": 0, "duration_ms": 80},
            {"name": "policy.lookup", "kind": "INTERNAL", "operation": "policy.lookup", "parent_index": 0, "duration_ms": 35},
            {"name": "model.reasoning", "kind": "CLIENT", "operation": "model_call", "parent_index": 0, "duration_ms": rng.uniform(200, 400)},
            {"name": "risk.evaluate", "kind": "INTERNAL", "operation": "risk.evaluate", "parent_index": 0, "duration_ms": 50},
            {"name": "business.outcome", "kind": "INTERNAL", "operation": "business.outcome", "parent_index": 0, "duration_ms": 15},
        ]
