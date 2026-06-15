"""Span event helpers — fleetrac.* namespace only."""

from __future__ import annotations

from typing import Any


def span_event(name: str, time_unix_nano: int, attributes: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "name": name,
        "time_unix_nano": time_unix_nano,
        "attributes": dict(attributes or {}),
    }


def model_request_started(time_ns: int) -> dict[str, Any]:
    return span_event("fleetrac.model.request.started", time_ns)


def model_response_received(time_ns: int) -> dict[str, Any]:
    return span_event("fleetrac.model.response.received", time_ns)


def policy_evaluated(time_ns: int, result: str) -> dict[str, Any]:
    return span_event("fleetrac.policy.evaluated", time_ns, {"fleetrac.policy.result": result})


def business_outcome_emitted(time_ns: int, outcome_type: str, status: str) -> dict[str, Any]:
    return span_event(
        "fleetrac.business_outcome.emitted",
        time_ns,
        {
            "fleetrac.business_outcome.type": outcome_type,
            "fleetrac.business_outcome.status": status,
        },
    )
