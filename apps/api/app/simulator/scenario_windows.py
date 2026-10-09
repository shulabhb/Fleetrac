"""In-process scenario window state for the continuous runner.

Injects a short story-shaped phase sequence without a second generator.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field

from app.simulator.config.scenario_stories import (
    STORY_PHASES,
    ScenarioStory,
    resolve_story,
)

_lock = threading.Lock()
_active: ScenarioWindow | None = None


@dataclass
class ScenarioWindow:
    story: ScenarioStory
    phases: list[str]
    events_per_phase: int
    phase_index: int = 0
    events_in_phase: int = 0
    total_emitted: int = 0

    @property
    def current_phase(self) -> str:
        if self.phase_index >= len(self.phases):
            return "done"
        return self.phases[self.phase_index]

    @property
    def done(self) -> bool:
        return self.phase_index >= len(self.phases)

    def advance_after_emit(self) -> None:
        self.events_in_phase += 1
        self.total_emitted += 1
        if self.events_in_phase >= self.events_per_phase:
            self.phase_index += 1
            self.events_in_phase = 0


def start_window(
    story_id: str,
    *,
    phases: list[str] | None = None,
    events_per_phase: int = 3,
) -> ScenarioWindow:
    global _active
    story = resolve_story(story_id)
    if story is None:
        raise ValueError(f"Unknown scenario story: {story_id}")
    resolved_phases = phases or [
        "degradation",
        "incident_window",
        "post_action_verification",
        "recovery",
    ]
    for p in resolved_phases:
        if p not in STORY_PHASES and p != "done":
            raise ValueError(f"Unknown phase: {p}")
    window = ScenarioWindow(
        story=story,
        phases=list(resolved_phases),
        events_per_phase=max(1, min(events_per_phase, 20)),
    )
    with _lock:
        _active = window
    return window


def clear_window() -> None:
    global _active
    with _lock:
        _active = None


def get_window() -> ScenarioWindow | None:
    with _lock:
        return _active


def peek_emit_plan() -> tuple[str, str, str] | None:
    """Return (system_id, mode, mutation_id) for next continuous tick, or None."""
    with _lock:
        w = _active
        if w is None or w.done:
            return None
        phase = w.current_phase
        return w.story.system_id, phase, w.story.mutation_id


def commit_emit() -> None:
    with _lock:
        w = _active
        if w is None or w.done:
            return
        w.advance_after_emit()
        if w.done:
            # Keep last window metadata readable via get_window until cleared
            pass


def window_status() -> dict:
    with _lock:
        w = _active
        if w is None:
            return {"active": False}
        return {
            "active": not w.done,
            "story_id": w.story.id,
            "system_id": w.story.system_id,
            "pitch_alias": w.story.pitch_alias,
            "expected_verification": w.story.expected_verification,
            "phase": w.current_phase,
            "phase_index": w.phase_index,
            "phases": list(w.phases),
            "events_per_phase": w.events_per_phase,
            "events_in_phase": w.events_in_phase,
            "total_emitted": w.total_emitted,
            "done": w.done,
        }
