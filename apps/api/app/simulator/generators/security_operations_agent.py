"""Security and operations agent archetype."""

from __future__ import annotations

from app.fleet.registry import FleetSystem
from app.simulator.generators.base import ArchetypeGenerator


class SecurityOperationsAgentGenerator(ArchetypeGenerator):
    archetype = "security_operations"

    def span_specs(self, system: FleetSystem, rng) -> list[dict]:
        latency = system.baseline_metrics.get("latency_ms", 400)
        return [
            {"name": "agent.request", "kind": "SERVER", "operation": "agent.request", "parent_index": None, "duration_ms": 20},
            {"name": "message.ingest", "kind": "INTERNAL", "operation": "message.ingest", "parent_index": 0, "duration_ms": 35},
            {"name": "classify.threat", "kind": "INTERNAL", "operation": "classification", "parent_index": 0, "duration_ms": 50},
            {"name": "model.reasoning", "kind": "CLIENT", "operation": "model_call", "parent_index": 0, "duration_ms": latency},
            {"name": "policy.evaluate", "kind": "INTERNAL", "operation": "policy_eval", "parent_index": 0, "duration_ms": 30},
            {"name": "tool.route", "kind": "CLIENT", "operation": "tool_call", "parent_index": 0, "duration_ms": 40},
            {"name": "business.outcome", "kind": "INTERNAL", "operation": "business.outcome", "parent_index": 0, "duration_ms": 12},
        ]
