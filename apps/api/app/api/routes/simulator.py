from __future__ import annotations

from importlib import import_module
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import Incident, RawEvent, SimulatorState
from app.db.seed import reset_to_seed
from app.db.session import get_db
from app.simulator.http_ingest_client import post_ingest_sequence
from app.simulator.runner import is_running, start_continuous, stop_continuous
from app.simulator.scenarios.catalog import IMPLEMENTED_SCENARIOS, PITCH_SEQUENCES, PLANNED_SCENARIOS
from app.simulator.scenarios.healthy_baseline import healthy_baseline_batch
from app.simulator.generators.healthy_traffic import healthy_trace_bundle
from app.simulator.scenarios.platform import (
    provider_latency_regression_sequence,
    tool_scope_violation_sequence,
    unsupported_claim_spike_sequence,
)
from app.simulator.scenarios.remediation_applied import remediation_applied_sequence
from app.slice_a.constants import INCIDENT_CANONICAL_ID, SYSTEM_ID

router = APIRouter(prefix="/simulator", tags=["simulator"])

SCENARIO_FN = {
    "unsupported_claim_spike": lambda sid, impact_mode=None: unsupported_claim_spike_sequence(sid, impact_mode),
    "tool_scope_violation": lambda sid, impact_mode=None: tool_scope_violation_sequence(sid, impact_mode),
    "provider_latency_regression": lambda sid, impact_mode=None: provider_latency_regression_sequence(sid, impact_mode),
    "remediation_applied": remediation_applied_sequence,
}


class ScenarioRequest(BaseModel):
    system_id: str = Field(default=SYSTEM_ID)
    impact_mode: str | None = Field(
        default=None,
        description="Evidence stage: contained | degraded | materialized",
    )


class StartRequest(BaseModel):
    mode: str = "continuous"
    rate_eps: float = Field(default=5.0, ge=0.1, le=20.0)
    systems: list[str] | None = None
    seed: int = Field(default=42, ge=0)


class RunBatchRequest(BaseModel):
    seed: int = Field(default=42, ge=0)
    count: int = Field(default=5, ge=1, le=50)
    systems: list[str] | None = None


class ScenarioFailure(BaseModel):
    index: int
    error: str
    status_code: int | None = None


class ScenarioResponse(BaseModel):
    scenario: str
    posted: int
    failed: ScenarioFailure | None = None
    incident_id: str | None = None


class SimulatorStatus(BaseModel):
    running: bool
    mode: str
    rate_eps: float | None = None
    last_scenario: str | None
    event_count: int
    incident_id: str | None
    last_error: str | None = None
    trace_builder_revision: str | None = None


async def _run_envelopes(
    db: Session,
    scenario_name: str,
    envelopes: list[dict[str, Any]],
) -> ScenarioResponse:
    state = db.get(SimulatorState, 1)
    if state is None:
        state = SimulatorState(id=1)
        db.add(state)
    state.last_scenario = scenario_name
    state.last_error = None
    db.commit()

    results = await post_ingest_sequence(envelopes, base_url=settings.simulator_api_base_url)
    posted = 0
    failure: ScenarioFailure | None = None
    for r in results:
        if r.ok:
            posted += 1
        else:
            failure = ScenarioFailure(
                index=r.index,
                error=r.error or "unknown error",
                status_code=r.status_code,
            )
            break

    state = db.get(SimulatorState, 1)
    assert state is not None
    state.event_count = db.query(RawEvent).count()
    inc = db.query(Incident).order_by(Incident.updated_at.desc()).first()
    state.incident_id = inc.id if inc else None
    if failure:
        state.last_error = failure.error
    db.commit()

    if failure:
        raise HTTPException(
            status_code=502,
            detail={
                "message": "Scenario ingest loopback failed",
                "failure": failure.model_dump(),
                "posted": posted,
            },
        )

    return ScenarioResponse(
        scenario=scenario_name,
        posted=posted,
        failed=None,
        incident_id=state.incident_id,
    )


@router.post("/reset")
def simulator_reset(db: Session = Depends(get_db)) -> dict[str, str]:
    stop_continuous()
    reset_to_seed(db)
    return {"status": "reset"}


@router.get("/status", response_model=SimulatorStatus)
def simulator_status(db: Session = Depends(get_db)) -> SimulatorStatus:
    from app.simulator.trace_builder import TRACE_BUILDER_REVISION

    state = db.get(SimulatorState, 1)
    if state is None:
        return SimulatorStatus(
            running=False,
            mode="idle",
            rate_eps=None,
            last_scenario=None,
            event_count=0,
            incident_id=None,
            trace_builder_revision=TRACE_BUILDER_REVISION,
        )
    return SimulatorStatus(
        running=is_running() or state.running,
        mode=state.mode or "idle",
        rate_eps=state.rate_eps,
        last_scenario=state.last_scenario,
        event_count=state.event_count,
        incident_id=state.incident_id,
        last_error=state.last_error,
        trace_builder_revision=TRACE_BUILDER_REVISION,
    )


@router.post("/start")
def simulator_start(body: StartRequest, db: Session = Depends(get_db)) -> dict:
    state = db.get(SimulatorState, 1) or SimulatorState(id=1)
    if state.id != 1:
        db.add(state)
    state.running = True
    state.mode = body.mode
    state.rate_eps = body.rate_eps
    state.active_systems = body.systems or []
    state.seed = body.seed
    db.commit()
    if body.mode == "continuous":
        start_continuous(system_ids=body.systems, rate_eps=body.rate_eps, seed=body.seed)
    return {"status": "started", "mode": body.mode, "seed": body.seed}


@router.post("/pause")
def simulator_pause(db: Session = Depends(get_db)) -> dict:
    stop_continuous()
    state = db.get(SimulatorState, 1)
    if state:
        state.running = False
        state.mode = "paused"
        db.commit()
    return {"status": "paused"}


@router.post("/stop")
def simulator_stop(db: Session = Depends(get_db)) -> dict:
    stop_continuous()
    state = db.get(SimulatorState, 1)
    if state:
        state.running = False
        state.mode = "idle"
        db.commit()
    return {"status": "stopped"}


@router.get("/scenarios")
def list_scenarios() -> dict:
    def _dto(cfg) -> dict:
        return {
            "id": cfg.id,
            "status": cfg.status,
            "eligible_archetypes": list(cfg.eligible_archetypes),
            "eligible_systems": list(cfg.eligible_systems or ()),
            "expected_incident": bool(cfg.expected_incident),
        }

    return {
        "implemented": [_dto(v) for v in IMPLEMENTED_SCENARIOS.values()],
        "planned": [_dto(v) for v in PLANNED_SCENARIOS.values()],
    }


@router.post("/runs", response_model=ScenarioResponse)
async def simulator_run_batch(
    body: RunBatchRequest,
    db: Session = Depends(get_db),
) -> ScenarioResponse:
    from app.fleet.registry import FLEET_SYSTEMS

    systems = body.systems or [s.id for s in FLEET_SYSTEMS]
    run_id = f"sim_run_{body.seed}"
    envelopes = [
        healthy_trace_bundle(
            systems[i % len(systems)],
            seed=body.seed,
            seq=i,
            simulator_run_id=run_id,
        )
        for i in range(body.count)
    ]
    return await _run_envelopes(db, "batch_run", envelopes)


@router.post("/resume")
def simulator_resume(db: Session = Depends(get_db)) -> dict:
    state = db.get(SimulatorState, 1)
    if state and state.mode == "paused":
        start_continuous(
            system_ids=state.active_systems or None,
            rate_eps=state.rate_eps or 5.0,
            seed=getattr(state, "seed", 42) or 42,
        )
        state.running = True
        state.mode = "continuous"
        db.commit()
    return {"status": "resumed"}


@router.post("/scenarios/{scenario_id}", response_model=ScenarioResponse)
async def run_scenario(
    scenario_id: str,
    body: ScenarioRequest,
    db: Session = Depends(get_db),
) -> ScenarioResponse:
    fn = SCENARIO_FN.get(scenario_id)
    if fn is None:
        raise HTTPException(status_code=404, detail=f"Unknown scenario: {scenario_id}")
    if scenario_id == "remediation_applied":
        envelopes = fn(body.system_id)
    else:
        envelopes = fn(body.system_id, body.impact_mode)
    return await _run_envelopes(db, scenario_id, envelopes)


@router.post("/scenarios/unsupported_claim_spike", response_model=ScenarioResponse)
async def run_unsupported_claim_spike(
    body: ScenarioRequest,
    db: Session = Depends(get_db),
) -> ScenarioResponse:
    return await run_scenario("unsupported_claim_spike", body, db)


@router.post("/pitch/{pitch_id}", response_model=dict)
async def run_pitch(pitch_id: str, db: Session = Depends(get_db)) -> dict:
    steps = PITCH_SEQUENCES.get(pitch_id)
    if steps is None:
        raise HTTPException(status_code=404, detail=f"Unknown pitch: {pitch_id}")
    results = []
    for step_name, kwargs in steps:
        if step_name == "healthy_baseline":
            count = kwargs.get("count", 5)
            systems = [s.id for s in import_module("app.fleet.registry").FLEET_SYSTEMS]
            envelopes = healthy_baseline_batch(systems, count=count)
            resp = await _run_envelopes(db, "healthy_baseline", envelopes)
            results.append(resp.model_dump())
        else:
            fn = SCENARIO_FN.get(step_name)
            if fn is None:
                continue
            sid = kwargs.get("system_id", SYSTEM_ID)
            if step_name == "remediation_applied":
                envelopes = fn(sid, count=kwargs.get("count", 5))
            else:
                envelopes = fn(sid)
            resp = await _run_envelopes(db, step_name, envelopes)
            results.append(resp.model_dump())
    return {"pitch_id": pitch_id, "steps": results}


async def run_scenario_with_transport(
    transport: httpx.AsyncBaseTransport,
    *,
    system_id: str = SYSTEM_ID,
    db: Session,
) -> ScenarioResponse:
    """Test helper: run scenario via ASGI transport (HTTP loopback)."""
    envelopes = unsupported_claim_spike_sequence(system_id)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        results = await post_ingest_sequence(envelopes, client=client, base_url="http://test")

    posted = sum(1 for r in results if r.ok)
    failure = next((r for r in results if not r.ok), None)
    state = db.get(SimulatorState, 1)
    if state:
        state.last_scenario = "unsupported_claim_spike"
        state.event_count = db.query(RawEvent).count()
        inc = db.query(Incident).filter(Incident.id == INCIDENT_CANONICAL_ID).one_or_none()
        state.incident_id = inc.id if inc else None
        db.commit()

    if failure:
        return ScenarioResponse(
            scenario="unsupported_claim_spike",
            posted=posted,
            failed=ScenarioFailure(
                index=failure.index,
                error=failure.error or "failed",
                status_code=failure.status_code,
            ),
            incident_id=state.incident_id if state else None,
        )
    return ScenarioResponse(
        scenario="unsupported_claim_spike",
        posted=posted,
        failed=None,
        incident_id=state.incident_id if state else None,
    )
