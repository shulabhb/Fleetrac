"""Background continuous simulation — posts healthy v2 trace bundles via HTTP loopback."""

from __future__ import annotations

import asyncio
import threading
import time
from typing import Any

from app.core.config import settings
from app.fleet.registry import FLEET_SYSTEMS
from app.simulator.generators.healthy_traffic import healthy_trace_bundle
from app.simulator.http_ingest_client import post_ingest_sequence

_runner_thread: threading.Thread | None = None
_stop_flag: threading.Event | None = None
_seq = 0
_current_seed = 42


async def _continuous_loop(
    system_ids: list[str],
    rate_eps: float,
    seed: int,
    stop: threading.Event,
) -> None:
    global _seq
    delay = 1.0 / max(rate_eps, 0.1)
    run_id = f"sim_run_{seed}"
    while not stop.is_set():
        sid = system_ids[_seq % len(system_ids)]
        bundle = healthy_trace_bundle(sid, seed=seed, seq=_seq, simulator_run_id=run_id)
        _seq += 1
        await post_ingest_sequence([bundle], base_url=settings.simulator_api_base_url)
        end = time.monotonic() + delay
        while time.monotonic() < end and not stop.is_set():
            await asyncio.sleep(0.05)


def _thread_main(system_ids: list[str], rate_eps: float, seed: int, stop: threading.Event) -> None:
    asyncio.run(_continuous_loop(system_ids, rate_eps, seed, stop))


def start_continuous(
    *,
    system_ids: list[str] | None = None,
    rate_eps: float = 5.0,
    seed: int = 42,
) -> None:
    global _runner_thread, _stop_flag, _seq, _current_seed
    stop_continuous()
    _current_seed = seed
    ids = system_ids or [s.id for s in FLEET_SYSTEMS]
    _stop_flag = threading.Event()
    _runner_thread = threading.Thread(
        target=_thread_main,
        args=(ids, rate_eps, seed, _stop_flag),
        daemon=True,
        name="fleetrac-simulator",
    )
    _runner_thread.start()


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
