"""Demo-fleet traffic profiles — story-shaped rates, not big-data cosplay.

Local defaults stay safe (~1 event / 2–5s). Stress is opt-in only.
"""

from __future__ import annotations

from dataclasses import dataclass

# Frontend DEMO_AGENT_IDS mirror — backend may still have 10 systems.
DEMO_AGENT_IDS: tuple[str, ...] = (
    "sys-agt-treasury-001",
    "sys-agt-phish-008",
    "sys-agt-cs-002",
    "sys-agt-rag-007",
    "sys-agt-access-009",
)


@dataclass(frozen=True)
class AgentTrafficProfile:
    system_id: str
    display_name: str
    # Relative weight for continuous mix (higher = more events)
    weight: float
    # Illustrative business-hour requests/hour (documentation / UI status only)
    business_hour_rph: tuple[int, int]
    off_hour_rph: tuple[int, int]
    primary_metrics: tuple[str, ...]
    governing_rules: tuple[str, ...]


AGENT_PROFILES: dict[str, AgentTrafficProfile] = {
    "sys-agt-treasury-001": AgentTrafficProfile(
        system_id="sys-agt-treasury-001",
        display_name="Treasury Commentary / M40",
        weight=1.2,
        business_hour_rph=(20, 80),
        off_hour_rph=(1, 10),
        primary_metrics=(
            "grounding_score",
            "unsupported_claim_rate",
            "audit_coverage_pct",
        ),
        governing_rules=("rule_unsupported_claim_high", "rule_grounding_low"),
    ),
    "sys-agt-phish-008": AgentTrafficProfile(
        system_id="sys-agt-phish-008",
        display_name="Phishing Triage",
        weight=1.0,
        business_hour_rph=(10, 50),
        off_hour_rph=(5, 20),
        primary_metrics=(
            "security_anomaly_count",
            "tool_success_rate",
            "policy_violation_rate",
        ),
        governing_rules=("rule_tool_scope_violation",),
    ),
    "sys-agt-cs-002": AgentTrafficProfile(
        system_id="sys-agt-cs-002",
        display_name="Customer Support Routing / A12",
        weight=2.0,
        business_hour_rph=(100, 500),
        off_hour_rph=(20, 80),
        primary_metrics=(
            "latency_ms",
            "policy_violation_rate",
            "unsupported_claim_rate",
            "cost_usd",
        ),
        governing_rules=("rule_latency_high",),
    ),
    "sys-agt-rag-007": AgentTrafficProfile(
        system_id="sys-agt-rag-007",
        display_name="Internal Knowledge RAG",
        weight=1.4,
        business_hour_rph=(30, 150),
        off_hour_rph=(5, 20),
        primary_metrics=(
            "retrieval_success_rate",
            "grounding_score",
            "unsupported_claim_rate",
        ),
        governing_rules=("rule_retrieval_failure", "rule_grounding_low"),
    ),
    "sys-agt-access-009": AgentTrafficProfile(
        system_id="sys-agt-access-009",
        display_name="Access Review",
        weight=0.6,
        business_hour_rph=(5, 30),
        off_hour_rph=(1, 5),
        primary_metrics=(
            "audit_coverage_pct",
            "policy_violation_rate",
        ),
        governing_rules=("rule_unapproved_region",),
    ),
}


@dataclass(frozen=True)
class RateProfile:
    """eps = events per second across the active fleet mix."""

    id: str
    rate_eps: float
    description: str
    max_events: int | None = None  # None = unbounded continuous


# Safe local defaults — not 100k+/day cosplay
RATE_PROFILES: dict[str, RateProfile] = {
    "baseline": RateProfile(
        id="baseline",
        rate_eps=0.3,  # ~1 event / 3.3s
        description="Normal demo traffic — believable governance loop",
    ),
    "active_demo": RateProfile(
        id="active_demo",
        rate_eps=1.0,  # ~1 event / second
        description="Active walkthrough pacing",
    ),
    "quiet": RateProfile(
        id="quiet",
        rate_eps=0.2,  # ~1 event / 5s
        description="Off-hours background",
    ),
    "stress": RateProfile(
        id="stress",
        rate_eps=10.0,
        description="Explicit stress burst only — opt-in",
        max_events=200,
    ),
}

DEFAULT_RATE_EPS = RATE_PROFILES["baseline"].rate_eps
DEFAULT_CONTINUOUS_SYSTEMS = list(DEMO_AGENT_IDS)
MAX_RATE_EPS = 20.0
MIN_RATE_EPS = 0.05


def resolve_systems(systems: list[str] | None, *, profile: str = "demo") -> list[str]:
    if systems:
        return list(systems)
    if profile == "full_fleet":
        from app.fleet.registry import FLEET_SYSTEMS

        return [s.id for s in FLEET_SYSTEMS]
    return list(DEMO_AGENT_IDS)


def weighted_pick(system_ids: list[str], seq: int) -> str:
    """Deterministic weighted round-robin favoring higher-traffic demo agents."""
    if not system_ids:
        return DEMO_AGENT_IDS[0]
    weights = [AGENT_PROFILES.get(sid, AgentTrafficProfile(
        system_id=sid,
        display_name=sid,
        weight=1.0,
        business_hour_rph=(10, 40),
        off_hour_rph=(1, 5),
        primary_metrics=(),
        governing_rules=(),
    )).weight for sid in system_ids]
    total = sum(weights) or 1.0
    # Expand into a repeating slate proportional to weight
    slate: list[str] = []
    for sid, w in zip(system_ids, weights):
        slots = max(1, int(round(w * 10 / total * len(system_ids))))
        slate.extend([sid] * slots)
    if not slate:
        return system_ids[0]
    return slate[seq % len(slate)]
