"""Tool scope violation — delegates to v2 trace bundle generator."""

from __future__ import annotations

from typing import Any

from app.simulator.scenarios.platform import tool_scope_violation_sequence as _bundle_sequence


def tool_scope_violation_sequence(system_id: str = "sys-agt-phish-008") -> list[dict[str, Any]]:
    return _bundle_sequence(system_id)
