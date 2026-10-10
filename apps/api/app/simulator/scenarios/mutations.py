"""Scenario mutations applied to healthy traces."""

from __future__ import annotations

from app.simulator.models import RunContext, SimulatedTrace
from app.simulator.telemetry.events import (
    business_outcome_emitted,
    policy_evaluated,
    span_event,
)


def apply_scenario_mutation(
    trace: SimulatedTrace,
    scenario_id: str,
    ctx: RunContext,
    *,
    impact_mode: str | None = None,
) -> None:
    mode = impact_mode or getattr(ctx, "impact_mode", None)
    if scenario_id == "unsupported_claim_spike":
        _unsupported_claim_spike(trace, mode)
    elif scenario_id == "tool_scope_violation":
        _tool_scope_violation(trace, mode)
    elif scenario_id == "provider_latency_regression":
        _provider_latency_regression(trace, mode)
    elif scenario_id == "excessive_tool_retries":
        _excessive_tool_retries(trace, mode)
    elif scenario_id == "retrieval_failure":
        _retrieval_failure(trace)
    elif scenario_id == "unapproved_region":
        _unapproved_region(trace)
    elif scenario_id == "near_miss":
        _near_miss(trace)
        if trace.spans:
            from app.simulator.trace_builder import finalize_root_span_duration

            finalize_root_span_duration(trace.spans)
            _append_scenario_logs(trace, scenario_id)
        return
    elif scenario_id == "soft_degradation":
        _soft_degradation(trace)
        # Soft degradation stays under control thresholds — no incident spam.
        if trace.spans:
            from app.simulator.trace_builder import finalize_root_span_duration

            finalize_root_span_duration(trace.spans)
            _append_scenario_logs(trace, scenario_id)
        return

    if trace.spans:
        from app.simulator.trace_builder import finalize_root_span_duration

        finalize_root_span_duration(trace.spans)
        _append_scenario_logs(trace, scenario_id)


def _soft_degradation(trace: SimulatedTrace) -> None:
    """Nudge metrics toward thresholds without crossing them (degradation phase)."""
    claim_span = _span_named(trace, "evaluate.unsupported_claims")
    ground_span = _span_named(trace, "evaluate.grounding")
    model_span = _span_named(trace, "model.reasoning", "model_call", "model.generate", "model.summarize")
    if claim_span:
        # Threshold for unsupported_claim is > 0.03 — stay under.
        claim_span.evaluation["unsupported_claim_rate"] = 0.022
    if ground_span:
        # Threshold for grounding is < 0.75 — stay above.
        ground_span.evaluation["grounding_score"] = 0.81
    if model_span and model_span.latency_ms is not None:
        # Threshold for latency is > 800 — stay under.
        lat = min(720.0, max(float(model_span.latency_ms), 480.0))
        model_span.latency_ms = lat
        model_span.evaluation["latency_ms"] = lat
        model_span.evaluation["operation_latency_ms"] = lat
    _set_business_outcome(trace, "draft_completed")


def _find_span(trace: SimulatedTrace, *names: str):
    for sp in trace.spans:
        if sp.name in names or sp.operation in names:
            return sp
    return trace.spans[-1] if trace.spans else None


def _set_business_outcome(trace: SimulatedTrace, status: str) -> None:
    outcome_span = _find_span(trace, "business.outcome")
    if outcome_span:
        outcome_span.attributes["fleetrac.business_outcome.status"] = status
    if trace.business_outcome is not None:
        trace.business_outcome["status"] = status


def _unsupported_claim_spike(trace: SimulatedTrace, impact_mode: str | None) -> None:
    claim_span = _find_span(trace, "evaluate.unsupported_claims")
    ground_span = _find_span(trace, "evaluate.grounding")
    verify_span = _find_span(trace, "verify.citations", "citation.verify")

    if claim_span:
        claim_span.evaluation.update({"unsupported_claim_rate": 0.041})
        if impact_mode in ("degraded", "materialized", None):
            claim_span.evaluation["recurrence"] = 1.0
        claim_span.events.append(
            span_event(
                "fleetrac.evaluation.unsupported_claim.detected",
                claim_span.end_time_unix_nano,
                {"fleetrac.evaluation.unsupported_claim_rate": 0.041},
            )
        )

    if ground_span and impact_mode != "contained":
        ground_span.evaluation.update(
            {
                "grounding_score": 0.76,
                "missing_citation_fallback": 1.0,
            }
        )

    if verify_span and impact_mode in ("degraded", "materialized", None):
        verify_span.evaluation["citation_verified"] = False
        verify_span.events.append(
            span_event(
                "fleetrac.citation.verification.failed",
                verify_span.end_time_unix_nano,
                {"fleetrac.citation.verified": False},
            )
        )

    if impact_mode == "contained":
        _set_business_outcome(trace, "held_for_review")
    elif impact_mode == "degraded":
        _set_business_outcome(trace, "held_for_review")
    elif impact_mode == "materialized":
        _set_business_outcome(trace, "published")
    else:
        # Legacy default pitch: full evidence without containment outcome.
        _set_business_outcome(trace, "draft_completed")


def _tool_scope_violation(trace: SimulatedTrace, impact_mode: str | None) -> None:
    tool_span = _find_span(
        trace,
        "quarantine.route",
        "route.select",
        "refund_tool.prepare",
        "tool.route",
        "tool_call",
    )
    if tool_span:
        tool_span.evaluation["tool_scope_violation"] = 1.0
        tool_span.policy_result = "deny"
        tool_span.attributes["gen_ai.tool.name"] = "refund_api_execute"
        tool_span.attributes["gen_ai.tool.status"] = "error"
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
        if impact_mode == "materialized":
            tool_span.evaluation["tool_execution_succeeded"] = True
            tool_span.attributes["fleetrac.tool.approved"] = True
            _set_business_outcome(trace, "unauthorized_action_executed")
        elif impact_mode == "degraded":
            tool_span.evaluation["recurrence"] = 1.0
            _set_business_outcome(trace, "escalated")
        else:
            _set_business_outcome(trace, "quarantined")


def _provider_latency_regression(trace: SimulatedTrace, impact_mode: str | None) -> None:
    model_span = _find_span(trace, "model.reasoning", "model_call", "model.generate", "model.summarize")
    if model_span:
        model_span.latency_ms = 1250.0
        model_span.end_time_unix_nano = model_span.start_time_unix_nano + int(1250 * 1_000_000)
        model_span.evaluation["latency_ms"] = 1250.0
        model_span.evaluation["operation_latency_ms"] = 1250.0
        retry_count = 5.0 if impact_mode in ("degraded", "materialized") else 2.0
        model_span.evaluation["retry_count"] = retry_count
        if impact_mode == "materialized":
            model_span.evaluation["fallback_failed"] = True
            model_span.evaluation["provider_error"] = True
        elif impact_mode == "degraded":
            model_span.evaluation["fallback_invoked"] = True
        model_span.events.append(
            span_event("fleetrac.model.request.started", model_span.start_time_unix_nano)
        )
        model_span.events.append(
            span_event("fleetrac.model.response.received", model_span.end_time_unix_nano)
        )
        model_span.events.append(
            span_event(
                "fleetrac.provider.latency.threshold_exceeded",
                model_span.end_time_unix_nano,
                {"fleetrac.evaluation.latency_ms": 1250.0},
            )
        )

    if impact_mode == "contained":
        _set_business_outcome(trace, "routed")
    elif impact_mode == "degraded":
        _set_business_outcome(trace, "routing_degraded")
    elif impact_mode == "materialized":
        _set_business_outcome(trace, "routing_unavailable")
    else:
        _set_business_outcome(trace, "routed")


def _retrieval_failure(trace: SimulatedTrace) -> None:
    span = _find_span(trace, "retrieve.context", "vector.search", "retrieval")
    if span:
        span.evaluation["retrieval_failure_rate"] = 0.22
        span.attributes["gen_ai.retrieval.hit_count"] = 0
        span.attributes["gen_ai.operation.name"] = "retrieval"
    _set_business_outcome(trace, "draft_completed")


def _unapproved_region(trace: SimulatedTrace) -> None:
    span = _find_span(trace, "policy.evaluate", "policy.lookup", "routing_policy.evaluate", "risk.evaluate")
    if span:
        span.evaluation["unapproved_region"] = 1.0
        span.policy_result = "deny"
        span.attributes["gen_ai.operation.name"] = "policy_eval"
    _set_business_outcome(trace, "held_for_review")


def _span_named(trace: SimulatedTrace, *names: str):
    for sp in trace.spans:
        if sp.name in names or sp.operation in names:
            return sp
    return None


def _near_miss(trace: SimulatedTrace) -> None:
    """Drift toward a threshold without crossing the rule or the supporting-signal band."""
    _soft_degradation(trace)
    claim = _span_named(trace, "evaluate.unsupported_claims")
    if claim:
        # Supporting-signal inference treats > 0.02 as elevated. Stay under that.
        claim.evaluation["unsupported_claim_rate"] = 0.018
    retrieval = _span_named(trace, "retrieve.context", "vector.search")
    if retrieval:
        retrieval.evaluation["retrieval_failure_rate"] = 0.05
        retrieval.attributes["gen_ai.retrieval.hit_count"] = 2


def _excessive_tool_retries(trace: SimulatedTrace, impact_mode: str | None) -> None:
    _provider_latency_regression(trace, impact_mode or "degraded")
    tool_span = _find_span(trace, "tool.route", "route.select", "quarantine.route", "tool_call")
    if tool_span:
        tool_span.evaluation["retry_count"] = 5.0
        tool_span.events.append(
            span_event("fleetrac.retry.scheduled", tool_span.end_time_unix_nano, {"fleetrac.tool.retry_count": 5})
        )


def _append_scenario_logs(trace: SimulatedTrace, scenario_id: str) -> None:
    if not trace.spans:
        return
    root = trace.spans[0]
    trace.logs.append(
        {
            "severity_text": "WARN" if scenario_id != "remediation_applied" else "INFO",
            "body": f"scenario={scenario_id} trace={trace.trace_id[:8]}",
            "timestamp_unix_nano": root.end_time_unix_nano,
        }
    )
