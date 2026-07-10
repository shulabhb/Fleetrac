"""Unsupported claim spike — delegates to v2 trace bundle generator."""

from __future__ import annotations

from typing import Any

from app.simulator.scenarios.platform import unsupported_claim_spike_sequence as _bundle_sequence


def unsupported_claim_spike_sequence(
    system_id: str | None = None,
    impact_mode: str | None = None,
) -> list[dict[str, Any]]:
    return _bundle_sequence(system_id, impact_mode)
