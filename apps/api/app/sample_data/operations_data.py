"""Per-system operational state generator.

Each system gets a deterministic operations record describing what version
is live, whether maintenance is active, whether rollback is available, and
so on. The data leans on existing attributes (risk_posture, environment,
regulatory_sensitivity) so the fleet reads like a plausible mix of healthy
active systems, watch-listed canaries, paused or rolled-back variants, and
the occasional maintenance window.
"""

from __future__ import annotations

import hashlib
import random
from datetime import datetime, timedelta, timezone

from app.sample_data.mock_data import MOCK_STORE
from app.schemas.operations import (
    MaintenanceWindow,
    OperationsState,
    ReleaseChannel,
    SystemOperations,
)


def _rng(seed: str) -> random.Random:
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()
    return random.Random(int(digest[:8], 16))


def _version_string(rng: random.Random, major: int) -> str:
    minor = rng.randint(0, 12)
    patch = rng.randint(0, 24)
    return f"v{major}.{minor}.{patch}"


def _operations_state_for(system, open_incidents_count: int, rng: random.Random) -> tuple[OperationsState, str | None]:
    """Pick an operations state that is consistent with risk posture."""

    posture = system.risk_posture
    # High-risk / critical systems occasionally are in canary, paused or
    # rollback-ready; healthy systems are mostly active; a few are in
    # maintenance regardless of posture.
    roll = rng.random()
    if posture == "critical" and open_incidents_count >= 2:
        if roll < 0.35:
            return ("paused", "Paused for review after multiple open high-severity incidents")
        if roll < 0.6:
            return ("rollback_ready", "Rollback target available from last stable version")
        if roll < 0.8:
            return ("degraded", "Running in degraded mode while remediation is evaluated")
        return ("active", None)
    if posture == "at_risk":
        if roll < 0.2:
            return ("rollback_ready", "Rollback candidate prepared by Bob")
        if roll < 0.32:
            return ("canary", "Canary release in progress, monitoring outcome")
        if roll < 0.42:
            return ("maintenance", "Scheduled maintenance window in effect")
        return ("active", None)
    if posture == "watch":
        if roll < 0.14:
            return ("canary", "Canary release monitored for drift")
        if roll < 0.22:
            return ("maintenance", "Planned maintenance window")
        return ("active", None)
    # healthy
    if roll < 0.05:
        return ("maintenance", "Routine maintenance window")
    if roll < 0.08:
        return ("internal_testing", "Internal testing only; not serving production traffic")
    return ("active", None)


def _release_channel(system, state: OperationsState) -> ReleaseChannel:
    if state == "canary":
        return "canary"
    if state == "internal_testing":
        return "internal"
    if system.environment == "staging":
        return "staging"
    return "production"


def _maintenance_window(state: OperationsState, rng: random.Random, now: datetime) -> MaintenanceWindow:
    if state != "maintenance":
        return MaintenanceWindow(active=False)
    started = now - timedelta(minutes=rng.randint(5, 90))
    ends = now + timedelta(minutes=rng.randint(30, 240))
    reasons = [
        "Dependency upgrade on retrieval connector",
        "Scheduled model weight refresh",
        "Governance control recalibration window",
        "Rollback rehearsal window",
        "Post-incident cooldown window",
    ]
    return MaintenanceWindow(
        active=True,
        reason=rng.choice(reasons),
        started_at=started,
        ends_at=ends,
        suppress_incident_noise=True,
        bob_allowed_during_maintenance=rng.random() < 0.3,
    )


def _build_operations(system, incidents_by_system: dict[str, list], now: datetime) -> SystemOperations:
    rng = _rng(f"ops::{system.id}")
    open_incidents = [
        i for i in incidents_by_system.get(system.id, []) if i.incident_status != "closed"
    ]
    open_count = len(open_incidents)

    state, state_reason = _operations_state_for(system, open_count, rng)
    channel = _release_channel(system, state)
    maintenance = _maintenance_window(state, rng, now)

    major = 2 if system.risk_posture in ("healthy", "watch") else 1
    current = _version_string(rng, major + rng.randint(0, 1))
    previous = _version_string(rng, major)
    while previous == current:
        previous = _version_string(rng, major)

    candidate = None
    if state in ("canary", "rollback_ready") or rng.random() < 0.18:
        candidate = _version_string(rng, major + 1)

    deployed_at = now - timedelta(days=rng.randint(1, 28), hours=rng.randint(0, 23))
    last_changed_by = rng.choice(
        [
            system.owner,
            "Release Engineering",
            "Model Risk Engineering",
            "Governance Workflow",
            "Bob (Governance Copilot)",
        ]
    )

    rollback_recommended = state == "rollback_ready" or (
        system.risk_posture in ("at_risk", "critical") and rng.random() < 0.3
    )
    rollback_blocked_reason = None
    rollback_available = True
    if state in ("disabled",):
        rollback_available = False
        rollback_blocked_reason = "System disabled — rollback requires manual re-enablement"
    elif system.regulatory_sensitivity and system.regulatory_sensitivity.lower() in {
        "high",
        "regulated",
        "restricted",
        "pii_sensitive",
    } and rng.random() < 0.25:
        rollback_blocked_reason = (
            "Regulated surface — rollback requires Compliance Reviewer sign-off before execution"
        )

    config_change_summaries = [
        "Tuned latency SLA threshold from p95 1500ms → 1400ms",
        "Tightened grounding threshold from 0.70 → 0.74",
        "Lowered drift review threshold from 0.26 → 0.23",
        "Rebalanced fallback routing weight 60/40 → 70/30",
        "Increased audit sampling to 100% for regulated output class",
        "Added review gate for policy-sensitive surface",
    ]
    last_config_change_summary = rng.choice(config_change_summaries)
    last_config_change_at = now - timedelta(hours=rng.randint(3, 320))

    canary_active = state == "canary"
    canary_pct = None
    if canary_active:
        canary_pct = float(rng.choice([5, 10, 15, 20, 25]))

    return SystemOperations(
        system_id=system.id,
        operations_state=state,
        operations_state_reason=state_reason,
        current_version=current,
        previous_version=previous,
        candidate_version=candidate,
        release_channel=channel,
        deployed_at=deployed_at,
        last_changed_by=last_changed_by,
        rollback_available=rollback_available,
        rollback_target=previous if rollback_available else None,
        rollback_requires_approval=system.environment == "production" or system.risk_posture in ("at_risk", "critical"),
        rollback_recommended=rollback_recommended,
        rollback_blocked_reason=rollback_blocked_reason,
        maintenance=maintenance,
        canary_active=canary_active,
        canary_traffic_pct=canary_pct,
        fallback_available=True,
        last_config_change_summary=last_config_change_summary,
        last_config_change_at=last_config_change_at,
        updated_at=now - timedelta(minutes=rng.randint(5, 360)),
    )


def generate_operations_store() -> dict[str, SystemOperations]:
    now = datetime.now(timezone.utc)
    systems = MOCK_STORE["systems"]
    incidents = MOCK_STORE["incidents"]
    incidents_by_system: dict[str, list] = {}
    for inc in incidents:
        incidents_by_system.setdefault(inc.system_id, []).append(inc)
    return {s.id: _build_operations(s, incidents_by_system, now) for s in systems}


OPERATIONS_STORE: dict[str, SystemOperations] = generate_operations_store()
