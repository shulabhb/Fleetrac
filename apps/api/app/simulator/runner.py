"""Background continuous simulation — posts healthy traffic via HTTP ingest loopback."""

from __future__ import annotations

import asyncio
from typing import Any

from app.core.config import settings
from app.fleet.registry import FLEET_SYSTEMS
from app.simulator.http_ingest_client import post_ingest_sequence
from app.simulator.scenarios.healthy_baseline import healthy_baseline_event

_runner_task: asyncio.Task | None = None
_stop_event: asyncio.Event | None = None
_seq = 0


async def _continuous_loop(system_ids: list[str], rate_eps: float) -> None:
    global _seq
    assert _stop_event is not None
    delay = 1.0 / max(rate_eps, 0.1)
    while not _stop_event.is_set():
        sid = system_ids[_seq % len(system_ids)]
        event = healthy_baseline_event(sid, seq=_seq)
        _seq += 1
        await post_ingest_sequence([event], base_url=settings.simulator_api_base_url)
        try:
            await asyncio.wait_for(_stop_event.wait(), timeout=delay)
            break
        except asyncio.TimeoutError:
            continue


def start_continuous(*, system_ids: list[str] | None = None, rate_eps: float = 5.0) -> None:
    global _runner_task, _stop_event, _seq
    stop_continuous()
    ids = system_ids or [s.id for s in FLEET_SYSTEMS]
    _stop_event = asyncio.Event()
    _runner_task = asyncio.create_task(_continuous_loop(ids, rate_eps))


def stop_continuous() -> None:
    global _runner_task, _stop_event
    if _stop_event:
        _stop_event.set()
    if _runner_task and not _runner_task.done():
        _runner_task.cancel()
    _runner_task = None
    _stop_event = None


def is_running() -> bool:
    return _runner_task is not None and not _runner_task.done()
