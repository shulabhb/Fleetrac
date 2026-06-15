"""Scenario mutations applied to healthy traces."""

from __future__ import annotations

from app.simulator.models import RunContext, SimulatedTrace
from app.simulator.telemetry.events import (
    business_outcome_emitted,
    policy_evaluated,
    span_event,
)


def apply_scenario_mutation(trace: SimulatedTrace, scenario_id: str, ctx: RunContext) -> None:
    if scenario_id == "unsupported_claim_spike":
        _unsupported_claim_spike(trace)
    elif scenario_id == "tool_scope_violation":
        _tool_scope_violation(trace)
    elif scenario_id == "provider_latency_regression":
        _provider_latency_regression(trace)
    elif scenario_id == "excessive_tool_retries":
        _excessive_tool_retries(trace)


def _find_span(trace: SimulatedTrace, *names: str):
    for sp in trace.spans:
        if sp.name in names or sp.operation in names:
            return sp
    return trace.spans[-1] if trace.spans else None


def _unsupported_claim_spike(trace: SimulatedTrace) -> None:
    eval_span = _find_span(trace, "evaluate.grounding", "evaluate.unsupported_claims", "output_evaluation")
    if eval_span:
        eval_span.evaluation.update(
            {
                "grounding_score": 0.52,
                "unsupported_claim_rate": 0.041,
                "missing_citation_fallback": 1.0,
                "recurrence": 1.0,
            }
        )
        eval_span.events.append(
            span_event(
                "fleetrac.evaluation.unsupported_claim.detected",
                eval_span.end_time_unix_nano,
                {"fleetrac.evaluation.unsupported_claim_rate": 0.041},
            )
        )


def _tool_scope_violation(trace: SimulatedTrace) -> None:
    tool_span = _find_span(trace, "tool.route", "tool_call")
    if tool_span:
        tool_span.evaluation["tool_scope_violation"] = 1.0
        tool_span.policy_result = "deny"
        tool_span.attributes["gen_ai.tool.name"] = "refund_api_execute"
        tool_span.attributes["fleetrac.tool.approved"] = False
        tool_span.events.append(
            span_event("fleetrac.tool.call.attempted", tool_span.start_time_unix_nano)
        )
        tool_span.events.append(
            span_event(
                "fleetrac.tool.call.denied",
                tool_span.end_time_unix_nano,
                {"fleetrac.policy.result": "deny"},
            )
        )


def _provider_latency_regression(trace: SimulatedTrace) -> None:
    model_span = _find_span(trace, "model.reasoning", "model_call", "model.generate")
    if model_span:
        model_span.latency_ms = 1250.0
        model_span.end_time_unix_nano = model_span.start_time_unix_nano + int(1250 * 1_000_000)
        model_span.evaluation["latency_ms"] = 1250.0
        model_span.evaluation["retry_count"] = 2.0
        model_span.events.append(
            span_event("fleetrac.model.request.started", model_span.start_time_unix_nano)
        )
        model_span.events.append(
            span_event("fleetrac.model.response.received", model_span.end_time_unix_nano)
        )


def _excessive_tool_retries(trace: SimulatedTrace) -> None:
    _provider_latency_regression(trace)
    tool_span = _find_span(trace, "tool.route", "tool_call")
    if tool_span:
        tool_span.evaluation["retry_count"] = 5.0
