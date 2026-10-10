"""Background continuous simulation — story-shaped demo-fleet telemetry via HTTP ingest.

Extends the existing generator path (healthy + scenario mutations). Does not
create a parallel simulator. Default rates stay safe for local prototypes.
"""

from __future__ import annotations

import asyncio
import threading
import time
from typing import Any

from app.core.config import settings
from app.simulator.config.traffic_profiles import (
    DEFAULT_CONTINUOUS_SYSTEMS,
    DEFAULT_RATE_EPS,
    MAX_RATE_EPS,
    MIN_RATE_EPS,
    RATE_PROFILES,
    resolve_systems,
    weighted_pick,
)
from app.simulator.episode_scheduler import POST_APPROVAL_BIAS, EpisodeScheduler
from app.simulator.generators.mode_traffic import emit_bundle
from app.simulator.http_ingest_client import open_ingest_client, post_ingest_sequence
from app.simulator import scenario_windows as windows

_runner_thread: threading.Thread | None = None
_stop_flag: threading.Event | None = None
_seq = 0
_current_seed = 42
_events_emitted = 0
_max_events: int | None = None
_rate_eps = DEFAULT_RATE_EPS
_profile_id = "baseline"
_active_systems: list[str] = list(DEFAULT_CONTINUOUS_SYSTEMS)
_scheduler: EpisodeScheduler | None = None


def _post_approval_map() -> dict[str, str]:
    """Agents with an approved action still waiting on telemetry."""
    try:
        from app.db.models import GovernedActionRow
        from app.db.session import get_session_factory

        session = get_session_factory()()
    except Exception:
        return {}
    try:
        rows = (
            session.query(GovernedActionRow)
            .filter(GovernedActionRow.status == "Approved")
            .filter(GovernedActionRow.verification_status == "Monitoring")
            .all()
        )
        out: dict[str, str] = {}
        for row in rows:
            bias = POST_APPROVAL_BIAS.get(row.system_id)
            if bias:
                out[row.system_id] = bias
        return out
    except Exception:
        return {}
    finally:
        session.close()


async def _continuous_loop(
    system_ids: list[str],
    rate_eps: float,
    seed: int,
    stop: threading.Event,
    max_events: int | None,
) -> None:
    global _seq, _events_emitted

    delay = 1.0 / max(rate_eps, MIN_RATE_EPS)
    run_id = f"sim_run_{seed}"
    base_url = settings.simulator_api_base_url
    async with open_ingest_client(base_url) as client:
        while not stop.is_set():
            if max_events is not None and _events_emitted >= max_events:
                break

            plan = windows.peek_emit_plan()
            if plan:
                sid, mode, mutation_id = plan
            elif _scheduler is not None:
                decided = _scheduler.next_plan(post_approval=_post_approval_map())
                sid, mode, mutation_id = decided.system_id, decided.mode, decided.mutation_id
            else:
                sid = weighted_pick(system_ids, _seq)
                mode = "baseline"
                mutation_id = None

            bundle = emit_bundle(
                sid,
                mode=mode,
                seed=seed,
                seq=_seq,
                simulator_run_id=run_id,
                mutation_id=mutation_id,
            )
            _seq += 1
            _events_emitted += 1
            if plan:
                windows.commit_emit()

            await post_ingest_sequence([bundle], client=client, base_url=base_url)
            end = time.monotonic() + delay
            while time.monotonic() < end and not stop.is_set():
                await asyncio.sleep(0.05)


def _thread_main(
    system_ids: list[str],
    rate_eps: float,
    seed: int,
    stop: threading.Event,
    max_events: int | None,
) -> None:
    asyncio.run(_continuous_loop(system_ids, rate_eps, seed, stop, max_events))


def start_continuous(
    *,
    system_ids: list[str] | None = None,
    rate_eps: float | None = None,
    seed: int = 42,
    profile: str = "demo",
    rate_profile: str | None = None,
    max_events: int | None = None,
) -> dict[str, Any]:
    """Start continuous demo-fleet traffic (default ~0.3 eps).

    rate_profile: baseline | active_demo | quiet | stress
    profile: demo (5 agents) | full_fleet
    """
    global _runner_thread, _stop_flag, _seq, _current_seed, _scheduler
    global _events_emitted, _max_events, _rate_eps, _profile_id, _active_systems

    stop_continuous()
    _current_seed = seed
    _seq = 0
    _events_emitted = 0

    # Explicit rate_eps wins over named profile (backward compatible with older clients).
    if rate_eps is not None:
        resolved_eps = rate_eps
        resolved_max = max_events
        _profile_id = rate_profile or "custom"
    elif rate_profile and rate_profile in RATE_PROFILES:
        rp = RATE_PROFILES[rate_profile]
        resolved_eps = rp.rate_eps
        resolved_max = max_events if max_events is not None else rp.max_events
        _profile_id = rate_profile
    else:
        resolved_eps = DEFAULT_RATE_EPS
        resolved_max = max_events
        _profile_id = "baseline"

    resolved_eps = max(MIN_RATE_EPS, min(float(resolved_eps), MAX_RATE_EPS))
    # Stress requires explicit rate_profile=stress (or caller max_events)
    if resolved_eps > 5.0 and rate_profile != "stress" and max_events is None:
        resolved_eps = min(resolved_eps, 5.0)

    ids = resolve_systems(system_ids, profile=profile)
    _active_systems = ids
    _rate_eps = resolved_eps
    _max_events = resolved_max
    # Faster cadence only when a test passes a small max_events budget.
    idle = 12 if resolved_max is not None and resolved_max <= 40 else 48
    _scheduler = EpisodeScheduler(seed, ids, idle_ticks=idle, burst=6, recovery=3, cooldown=18)

    _stop_flag = threading.Event()
    _runner_thread = threading.Thread(
        target=_thread_main,
        args=(ids, resolved_eps, seed, _stop_flag, resolved_max),
        daemon=True,
        name="fleetrac-simulator",
    )
    _runner_thread.start()
    return {
        "status": "started",
        "systems": ids,
        "rate_eps": resolved_eps,
        "rate_profile": _profile_id,
        "max_events": resolved_max,
        "seed": seed,
    }


def stop_continuous() -> None:
    global _runner_thread, _stop_flag
    if _stop_flag:
        _stop_flag.set()
    if _runner_thread and _runner_thread.is_alive():
        _runner_thread.join(timeout=3.0)
    _runner_thread = None
    _stop_flag = None


def is_running() -> bool:
    return _runner_thread is not None and _runner_thread.is_alive()


def current_seed() -> int:
    return _current_seed


def runner_status() -> dict[str, Any]:
    return {
        "running": is_running(),
        "rate_eps": _rate_eps,
        "rate_profile": _profile_id,
        "systems": list(_active_systems),
        "events_emitted": _events_emitted,
        "max_events": _max_events,
        "seed": _current_seed,
        "scenario_window": windows.window_status(),
        "episode": None
        if _scheduler is None or _scheduler.episode is None
        else {
            "id": _scheduler.episode.episode_id,
            "system_id": _scheduler.episode.system_id,
            "state": _scheduler.state,
        },
    }
