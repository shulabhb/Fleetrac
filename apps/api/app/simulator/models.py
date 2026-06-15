"""Simulator domain models."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class SimulatedSpan:
    span_id: str
    parent_span_id: str | None
    name: str
    kind: str
    start_time_unix_nano: int
    end_time_unix_nano: int
    attributes: dict[str, Any] = field(default_factory=dict)
    events: list[dict[str, Any]] = field(default_factory=list)
    operation: str = ""
    evaluation: dict[str, float] = field(default_factory=dict)
    policy_result: str | None = None
    latency_ms: float | None = None


@dataclass
class SimulatedTrace:
    trace_id: str
    system_id: str
    resource_attributes: dict[str, Any]
    scope_name: str
    scope_version: str
    spans: list[SimulatedSpan]
    business_outcome: dict[str, Any] | None = None
    logs: list[dict[str, Any]] = field(default_factory=list)
    metrics: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class RunContext:
    seed: int
    run_id: str
    start_time: datetime
    content_mode: str = "metadata_only"
    deterministic: bool = True
    simulator_run_id: str | None = None
    scenario_run_id: str | None = None
    impact_mode: str | None = None


@dataclass
class ScenarioConfig:
    id: str
    eligible_archetypes: tuple[str, ...]
    eligible_systems: tuple[str, ...] | None = None
    detection_phase: int = 1
    expected_incident: bool = False
    status: str = "implemented"  # implemented | planned
