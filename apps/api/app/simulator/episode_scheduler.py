"""Seeded episode scheduler for the continuous runner.

One episode at a time. Healthy and near-miss traces stay under existing thresholds.
Same seed replays the same agent picks and episode kinds.
"""

from __future__ import annotations

import random
from dataclasses import dataclass

from app.simulator.config.traffic_profiles import DEMO_AGENT_IDS, weighted_pick

# Existing mutations only. RAG and access set fields the current rules already read.
EPISODE_BY_SYSTEM: dict[str, tuple[str, str]] = {
    "sys-agt-treasury-001": ("unsupported_claim", "unsupported_claim_spike"),
    "sys-agt-phish-008": ("tool_scope", "tool_scope_violation"),
    "sys-agt-cs-002": ("latency", "provider_latency_regression"),
    "sys-agt-rag-007": ("empty_retrieval", "retrieval_failure"),
    "sys-agt-access-009": ("unapproved_region", "unapproved_region"),
}

POST_APPROVAL_BIAS: dict[str, str] = {
    "sys-agt-treasury-001": "improve",
    "sys-agt-phish-008": "stay_bad",
    "sys-agt-cs-002": "flat",
}


@dataclass
class EmitPlan:
    system_id: str
    mode: str  # baseline | near_miss | incident_window | recovery
    mutation_id: str | None
    episode_id: str | None
    state: str


@dataclass
class _Episode:
    episode_id: str
    system_id: str
    kind: str
    mutation_id: str
    remaining_bad: int
    recovery_left: int


class EpisodeScheduler:
    def __init__(
        self,
        seed: int,
        system_ids: list[str] | None = None,
        *,
        idle_ticks: int = 48,
        burst: int = 6,
        recovery: int = 4,
        cooldown: int = 24,
    ) -> None:
        self.seed = seed
        self.system_ids = list(system_ids or DEMO_AGENT_IDS)
        self.idle_ticks = max(4, idle_ticks)
        self.burst = max(4, min(8, burst))
        self.recovery = max(1, recovery)
        self.cooldown_len = max(1, cooldown)
        self._rng = random.Random(seed)
        self.tick_index = 0
        self.state = "idle"
        self.idle_seen = 0
        self.cooldown_left = 0
        self.episode: _Episode | None = None
        self._seq = 0

    def decisions(self, n: int) -> list[EmitPlan]:
        return [self.next_plan() for _ in range(n)]

    def next_plan(self, *, post_approval: dict[str, str] | None = None) -> EmitPlan:
        self.tick_index += 1
        bias = post_approval or {}

        if self.state == "active_burst" and self.episode is not None:
            ep = self.episode
            ep.remaining_bad -= 1
            plan = EmitPlan(ep.system_id, "incident_window", ep.mutation_id, ep.episode_id, "active_burst")
            if ep.remaining_bad <= 0:
                self.state = "recovery"
            return plan

        if self.state == "recovery" and self.episode is not None:
            ep = self.episode
            ep.recovery_left -= 1
            plan = EmitPlan(ep.system_id, "recovery", None, ep.episode_id, "recovery")
            if ep.recovery_left <= 0:
                self.episode = None
                self.state = "cooldown"
                self.cooldown_left = self.cooldown_len
            return plan

        if self.state == "cooldown":
            self.cooldown_left -= 1
            if self.cooldown_left <= 0:
                self.state = "idle"
                self.idle_seen = 0
            return self._healthy_or_bias(bias)

        self.idle_seen += 1
        if self.idle_seen >= self.idle_ticks:
            sid = self._pick_episode_agent(bias)
            kind, mutation = EPISODE_BY_SYSTEM.get(sid, ("unsupported_claim", "unsupported_claim_spike"))
            self._seq += 1
            burst = self.burst
            # Stay inside 4–8 even if constructor clamped.
            burst = max(4, min(8, burst))
            self.episode = _Episode(
                episode_id=f"ep_{self.seed}_{self._seq}",
                system_id=sid,
                kind=kind,
                mutation_id=mutation,
                remaining_bad=burst - 1,
                recovery_left=self.recovery,
            )
            self.state = "active_burst"
            self.idle_seen = 0
            return EmitPlan(sid, "incident_window", mutation, self.episode.episode_id, "active_burst")

        return self._healthy_or_bias(bias)

    def _pick_episode_agent(self, bias: dict[str, str]) -> str:
        from app.simulator.config.traffic_profiles import AGENT_PROFILES

        eligible = [sid for sid in self.system_ids if sid not in bias]
        pool = eligible or list(self.system_ids)
        weights = [AGENT_PROFILES[sid].weight if sid in AGENT_PROFILES else 1.0 for sid in pool]
        total = sum(weights) or 1.0
        draw = self._rng.random() * total
        acc = 0.0
        for sid, weight in zip(pool, weights):
            acc += weight
            if draw <= acc:
                return sid
        return pool[-1]

    def _healthy_or_bias(self, bias: dict[str, str]) -> EmitPlan:
        sid = weighted_pick(self.system_ids, self.tick_index + self.seed)
        kind = bias.get(sid)
        if kind == "stay_bad":
            mutation = EPISODE_BY_SYSTEM.get(sid, ("tool_scope", "tool_scope_violation"))[1]
            return EmitPlan(sid, "incident_window", mutation, None, self.state)
        if kind == "flat":
            return EmitPlan(sid, "near_miss", "near_miss", None, self.state)
        if kind == "improve":
            return EmitPlan(sid, "recovery", None, None, self.state)
        if self._rng.random() < 0.12:
            return EmitPlan(sid, "near_miss", "near_miss", None, self.state)
        return EmitPlan(sid, "baseline", None, None, self.state)
