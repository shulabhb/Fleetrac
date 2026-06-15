"""Agent run engine — healthy traces + scenario mutations."""

from __future__ import annotations

from datetime import datetime, timezone

from app.fleet.registry import SYSTEM_BY_ID
from app.fleet.system_metadata import metadata_for
from app.simulator.generators.decision_agent import DecisionAgentGenerator
from app.simulator.generators.document_agent import DocumentAgentGenerator
from app.simulator.generators.retrieval_agent import RetrievalAgentGenerator
from app.simulator.generators.security_operations_agent import SecurityOperationsAgentGenerator
from app.simulator.models import RunContext, SimulatedTrace
from app.simulator.scenarios.mutations import apply_scenario_mutation
from app.simulator.telemetry.events import (
    business_outcome_emitted,
    policy_evaluated,
    span_event,
)

GENERATORS = {
    "decision": DecisionAgentGenerator(),
    "retrieval_grounded": RetrievalAgentGenerator(),
    "document": DocumentAgentGenerator(),
    "security_operations": SecurityOperationsAgentGenerator(),
}


def _generator_for(system_id: str):
    meta = metadata_for(system_id)
    archetype = meta.get("archetype", "decision")
    return GENERATORS.get(archetype, GENERATORS["decision"])


def run_agent(
    system_id: str,
    scenario_id: str | None,
    ctx: RunContext,
) -> SimulatedTrace:
    system = SYSTEM_BY_ID[system_id]
    gen = _generator_for(system_id)
    trace = gen.build_healthy(system, ctx)
    if scenario_id:
        apply_scenario_mutation(trace, scenario_id, ctx)
    return trace


def make_run_context(
    *,
    seed: int,
    scenario_id: str | None = None,
    system_id: str | None = None,
    simulator_run_id: str | None = None,
) -> RunContext:
    run_id = f"run_{seed}_{system_id or 'fleet'}_{scenario_id or 'healthy'}"
    return RunContext(
        seed=seed,
        run_id=run_id,
        start_time=datetime.now(timezone.utc),
        scenario_run_id=f"{scenario_id}:{run_id}" if scenario_id else None,
        simulator_run_id=simulator_run_id,
    )
