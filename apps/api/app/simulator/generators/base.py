"""Archetype generator base."""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.fleet.registry import FleetSystem
from app.fleet.system_metadata import metadata_for
from app.simulator.models import RunContext, SimulatedTrace
from app.simulator.telemetry.resource import build_resource_attributes
from app.simulator.trace_builder import span_from_template, trace_id_hex


class ArchetypeGenerator(ABC):
    archetype: str

    @abstractmethod
    def span_specs(self, system: FleetSystem, rng) -> list[dict]:
        """Return list of span spec dicts: name, kind, operation, duration_ms, parent_index."""

    def build_healthy(self, system: FleetSystem, ctx: RunContext) -> SimulatedTrace:
        from app.simulator.trace_builder import seeded_rng

        rng = seeded_rng(ctx.seed)
        trace_id = trace_id_hex()
        base_ns = int(ctx.start_time.timestamp() * 1_000_000_000)
        meta = metadata_for(system.id)
        baselines = dict(system.baseline_metrics)

        specs = self.span_specs(system, rng)
        spans = []
        span_ids: list[str] = []
        cursor_ns = base_ns

        for idx, spec in enumerate(specs):
            parent_id = span_ids[spec["parent_index"]] if spec.get("parent_index") is not None else None
            duration = spec.get("duration_ms") or rng.uniform(40, 200)
            ev = dict(baselines)
            if spec.get("evaluation"):
                ev.update(spec["evaluation"])

            sp = span_from_template(
                name=spec["name"],
                kind=spec.get("kind", "INTERNAL"),
                parent_id=parent_id,
                start_ns=cursor_ns,
                duration_ms=duration,
                operation=spec.get("operation", spec["name"]),
                attributes={
                    "gen_ai.operation.name": spec.get("operation", spec["name"]),
                    "fleetrac.system.id": system.id,
                },
                evaluation=ev,
            )
            spans.append(sp)
            span_ids.append(sp.span_id)
            cursor_ns = sp.end_time_unix_nano + int(rng.uniform(1, 5) * 1_000_000)

        outcome_span = spans[-1] if spans else None
        return SimulatedTrace(
            trace_id=trace_id,
            system_id=system.id,
            resource_attributes=build_resource_attributes(system),
            scope_name="fleetrac.agent-simulator",
            scope_version="2026.06.1",
            spans=spans,
            business_outcome={
                "type": meta.get("business_function", "agent_run"),
                "status": "success",
                "span_id": outcome_span.span_id if outcome_span else None,
            },
        )
