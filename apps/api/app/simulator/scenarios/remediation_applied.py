"""Post-remediation healthy traffic — restores baseline metrics after governed action."""

from __future__ import annotations

from typing import Any

from app.simulator.scenarios.healthy_baseline import healthy_baseline_batch


def remediation_applied_sequence(system_id: str, *, count: int = 5) -> list[dict[str, Any]]:
    """Emit healthy baseline events for a system after remediation verify."""
    return healthy_baseline_batch([system_id], count=count)
