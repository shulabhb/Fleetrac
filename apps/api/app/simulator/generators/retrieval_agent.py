"""Retrieval-grounded agent archetype."""

from __future__ import annotations

from app.fleet.registry import FleetSystem
from app.simulator.generators.base import ArchetypeGenerator


class RetrievalAgentGenerator(ArchetypeGenerator):
    archetype = "retrieval_grounded"

    def span_specs(self, system: FleetSystem, rng) -> list[dict]:
        baselines = system.baseline_metrics
        grounding = baselines.get("grounding_score", 0.82)
        unsupported = baselines.get("unsupported_claim_rate", 0.01)
        return [
            {"name": "agent.request", "kind": "SERVER", "operation": "agent.request", "parent_index": None, "duration_ms": 25},
            {"name": "query.generate", "kind": "INTERNAL", "operation": "query.generate", "parent_index": 0, "duration_ms": 40},
            {"name": "retrieve.context", "kind": "INTERNAL", "operation": "retrieval", "parent_index": 0, "duration_ms": 60},
            {"name": "vector.search", "kind": "CLIENT", "operation": "retrieval", "parent_index": 2, "duration_ms": rng.uniform(80, 150)},
            {"name": "rerank.results", "kind": "CLIENT", "operation": "retrieval", "parent_index": 2, "duration_ms": 45},
            {"name": "model.generate", "kind": "CLIENT", "operation": "model_call", "parent_index": 0, "duration_ms": rng.uniform(300, 600)},
            {
                "name": "evaluate.grounding",
                "kind": "INTERNAL",
                "operation": "output_evaluation",
                "parent_index": 0,
                "duration_ms": 35,
                "evaluation": {"grounding_score": grounding, "unsupported_claim_rate": unsupported},
            },
            {"name": "verify.citations", "kind": "INTERNAL", "operation": "policy_eval", "parent_index": 0, "duration_ms": 30},
            {"name": "business.outcome", "kind": "INTERNAL", "operation": "business.outcome", "parent_index": 0, "duration_ms": 12},
        ]
