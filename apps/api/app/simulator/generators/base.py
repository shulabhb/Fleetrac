"""Archetype generator base."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from app.fleet.registry import FleetSystem
from app.fleet.system_metadata import metadata_for
from app.simulator.models import RunContext, SimulatedTrace
from app.simulator.healthy_variation import (
    evaluation_for_key_healthy,
    prepare_healthy_specs,
)
from app.simulator.telemetry.events import (
    business_outcome_emitted,
    policy_evaluated,
    span_event,
)
from app.simulator.telemetry.resource import build_resource_attributes
from app.simulator.trace_builder import build_spans_from_specs, seeded_rng, trace_id_hex


class ArchetypeGenerator(ABC):
    archetype: str

    @abstractmethod
    def span_specs(self, system: FleetSystem, rng) -> list[dict]:
        """Return list of span spec dicts."""

    def build_healthy(self, system: FleetSystem, ctx: RunContext) -> SimulatedTrace:
        rng = seeded_rng(ctx.seed)
        trace_id = trace_id_hex()
        base_ns = int(ctx.start_time.timestamp() * 1_000_000_000)
        meta = metadata_for(system.id)

        raw_specs = self.span_specs(system, rng)
        specs = prepare_healthy_specs(raw_specs, system, rng)

        def build_evaluation(spec: dict[str, Any]) -> dict[str, float]:
            cached = spec.get("_healthy_evaluation")
            if cached is not None:
                return dict(cached)
            return evaluation_for_key_healthy(spec.get("evaluation_key"), system, rng)

        def build_events(spec: dict[str, Any], start_ns: int, duration_ms: float) -> list[dict[str, Any]]:
            return _healthy_span_events(spec, start_ns, duration_ms)

        spans = build_spans_from_specs(
            specs,
            base_ns=base_ns,
            system_id=system.id,
            build_evaluation=build_evaluation,
            build_events=build_events,
        )

        if spans:
            root = spans[0]
            root.attributes.setdefault("fleetrac.environment", "production")
            root.attributes.setdefault("fleetrac.trace.status", "completed")

        outcome_span = next((sp for sp in reversed(spans) if sp.operation == "business.outcome"), spans[-1])
        logs = _trace_logs(spans, ctx)

        return SimulatedTrace(
            trace_id=trace_id,
            system_id=system.id,
            resource_attributes=build_resource_attributes(system),
            scope_name="fleetrac.agent-simulator",
            scope_version="2026.06.1",
            spans=spans,
            business_outcome={
                "type": meta.get("business_function", "agent_run"),
                "status": outcome_span.attributes.get("fleetrac.business_outcome.status", "success"),
                "span_id": outcome_span.span_id,
            },
            logs=logs,
        )


def _healthy_span_events(spec: dict[str, Any], start_ns: int, duration_ms: float) -> list[dict[str, Any]]:
    from app.simulator.trace_builder import ms_to_ns

    mid_ns = start_ns + ms_to_ns(duration_ms / 2)
    end_ns = start_ns + ms_to_ns(duration_ms)
    op = spec.get("operation", "")
    events: list[dict[str, Any]] = []

    if op == "policy_eval":
        result = spec.get("policy_result") or "allow"
        events.append(policy_evaluated(mid_ns, result))
    elif op == "retrieval":
        doc_count = (spec.get("_healthy_evaluation") or {}).get("document_count", 12)
        events.append(
            span_event(
                "fleetrac.retrieval.completed",
                end_ns,
                {"fleetrac.retrieval.document_count": doc_count},
            )
        )
    elif spec.get("name") in ("verify.citations", "citation.verify"):
        events.append(
            span_event("fleetrac.citation.verification.passed", end_ns, {"fleetrac.citation.verified": True})
        )
    elif op == "tool_call":
        events.append(
            span_event(
                "fleetrac.tool.call.approved",
                end_ns,
                {"fleetrac.tool.name": spec.get("attributes", {}).get("gen_ai.tool.name", "tool")},
            )
        )
    elif op == "business.outcome":
        status = spec.get("attributes", {}).get("fleetrac.business_outcome.status", "success")
        events.append(business_outcome_emitted(end_ns, spec.get("attributes", {}).get("fleetrac.business_outcome.type", "agent_run"), status))

    return events[:2]


def _trace_logs(spans: list, ctx: RunContext) -> list[dict[str, Any]]:
    if not spans:
        return []
    root = spans[0]
    return [
        {
            "severity_text": "INFO",
            "body": f"trace completed system={root.attributes.get('fleetrac.system.id')} spans={len(spans)}",
            "timestamp_unix_nano": root.end_time_unix_nano,
        }
    ]


from app.simulator.span_templates import resolve_span_specs


def _default_span_specs(system: FleetSystem, archetype: str, rng) -> list[dict]:
    return resolve_span_specs(system.id, archetype, system, rng)
