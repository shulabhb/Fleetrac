"""SimulatedTrace → schema_version 2.0 ingest bundle."""

from __future__ import annotations

import hashlib
import json
from typing import Any

from app.simulator.models import SimulatedTrace, RunContext
from app.simulator.telemetry.resource import build_instrumentation_scope


def trace_to_v2_bundle(
    trace: SimulatedTrace,
    *,
    ctx: RunContext | None = None,
    idempotency_key: str | None = None,
) -> dict[str, Any]:
    scenario_block: dict[str, Any] | None = None
    if ctx and ctx.scenario_run_id:
        scenario_block = {
            "id": ctx.scenario_run_id.split(":")[0] if ":" in ctx.scenario_run_id else "healthy_baseline",
            "run_id": ctx.scenario_run_id,
        }

    spans_out: list[dict[str, Any]] = []
    for sp in trace.spans:
        spans_out.append(
            {
                "span_id": sp.span_id,
                "parent_span_id": sp.parent_span_id,
                "name": sp.name,
                "kind": sp.kind,
                "start_time_unix_nano": sp.start_time_unix_nano,
                "end_time_unix_nano": sp.end_time_unix_nano,
                "status": {"code": "OK", "message": None},
                "attributes": {
                    **sp.attributes,
                    **{f"fleetrac.evaluation.{k}": v for k, v in sp.evaluation.items()},
                },
                "events": sp.events,
                "operation": sp.operation,
                "evaluation": sp.evaluation,
                "policy_result": sp.policy_result,
                "latency_ms": sp.latency_ms,
            }
        )

    bundle: dict[str, Any] = {
        "schema_version": "2.0",
        "source_type": "otel_agent_trace",
        "tenant_id": "tenant-demo",
        "environment": "production",
        "system_id": trace.system_id,
        "content_mode": ctx.content_mode if ctx else "metadata_only",
        "idempotency_key": idempotency_key or f"trace:{trace.trace_id}:bundle",
        "trace_id": trace.trace_id,
        "resource": {"attributes": trace.resource_attributes},
        "instrumentation_scope": build_instrumentation_scope(),
        "spans": spans_out,
        "logs": trace.logs,
        "metrics": trace.metrics,
    }
    if scenario_block:
        bundle["scenario"] = scenario_block
    if ctx and ctx.simulator_run_id:
        bundle["simulator_run_id"] = ctx.simulator_run_id

    raw = json.dumps(bundle, sort_keys=True, separators=(",", ":"))
    bundle["payload_hash"] = f"sha256:{hashlib.sha256(raw.encode()).hexdigest()[:32]}"
    if trace.business_outcome:
        bundle["business_outcome"] = trace.business_outcome
    return bundle
